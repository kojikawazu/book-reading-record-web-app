import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { disconnectDb, resetBookRecordTables } from "@tests/support/it-db";
import { validBookBody } from "@tests/support/it-harness";
import { PrismaBookRecordRepository } from "@/lib/server/prisma-book-record-repository";

const repository = new PrismaBookRecordRepository();

const seedBook = async (): Promise<string> => {
  const book = await repository.createBook(validBookBody);
  return book.id;
};

beforeEach(async () => {
  await resetBookRecordTables();
});

afterAll(async () => {
  await disconnectDb();
});

/**
 * 監査列（createdAt / updatedAt）は schema.prisma の `@default(now())` / `@updatedAt` が
 * 設定し、リポジトリ層では代入しない（`.claude/rules/database.md`）。その前提が実際に
 * 成り立っていることを実 Postgres で固定する。
 *
 */
describe("IT: PrismaBookRecordRepository の監査列（実 Postgres）", () => {
  // --- 正常系 ---
  it("createBook は createdAt / updatedAt を自動採番する", async () => {
    const book = await repository.createBook(validBookBody);

    expect(Number.isNaN(new Date(book.createdAt).getTime())).toBe(false);
    expect(Number.isNaN(new Date(book.updatedAt).getTime())).toBe(false);
  });

  it("saveReflection は書籍の updatedAt を進める（一覧の並び順が updatedAt 降順のため）", async () => {
    const id = await seedBook();
    const before = await repository.getBook(id);

    // updatedAt はミリ秒精度のため、同一ミリ秒に収まると差が出ずテストが不安定になる。
    // 実装の正否と無関係な揺れを避けるために最小限だけ待つ。
    await new Promise((resolve) => setTimeout(resolve, 10));
    const after = await repository.saveReflection(id, {
      learning: "学び",
      action: "行動",
      quote: "引用",
    });

    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(
      new Date(before!.updatedAt).getTime()
    );
  });

  it("updateBook は既存の感想を保持したまま書籍を返す", async () => {
    const id = await seedBook();
    await repository.saveReflection(id, { learning: "学び", action: "行動", quote: "引用" });

    const updated = await repository.updateBook(id, { title: "改題後タイトル" });

    // 感想の保存は saveReflection に一本化したが、updateBook の戻り値には反映され続ける。
    expect(updated.title).toBe("改題後タイトル");
    expect(updated.reflection).toMatchObject({ learning: "学び", action: "行動", quote: "引用" });
  });

  // --- 準正常系 ---
  it("感想を上書きしても reflection.createdAt は採番し直さない", async () => {
    const id = await seedBook();
    const first = await repository.saveReflection(id, {
      learning: "初版",
      action: "a1",
      quote: "q1",
    });

    const second = await repository.saveReflection(id, {
      learning: "改訂版",
      action: "a2",
      quote: "q2",
    });

    expect(second.reflection!.learning).toBe("改訂版");
    expect(second.reflection!.createdAt).toBe(first.reflection!.createdAt);
  });

  it("saveReflection は書籍の createdAt を書き換えない", async () => {
    const id = await seedBook();
    const before = await repository.getBook(id);

    await repository.saveReflection(id, { learning: "学び", action: "行動", quote: "引用" });
    const after = await repository.getBook(id);

    expect(after!.createdAt).toBe(before!.createdAt);
  });

  // --- 異常系 ---
  it("存在しない書籍への saveReflection は RepositoryNotFoundError", async () => {
    await expect(
      repository.saveReflection("00000000-0000-0000-0000-000000000000", {
        learning: "x",
        action: "y",
        quote: "z",
      })
    ).rejects.toThrow("対象の書籍が見つかりません。");
  });

  it("存在しない書籍への updateBook は RepositoryNotFoundError", async () => {
    await expect(
      repository.updateBook("00000000-0000-0000-0000-000000000000", { title: "x" })
    ).rejects.toThrow("対象の書籍が見つかりません。");
  });
});

/**
 * 総ページ数が未入力（`TOTAL_PAGES_UNKNOWN` = 0）の書籍の扱い。
 * `LocalStorageRepository` の UT と同じ観点を supabase ドライバ側でも固定し、
 * 両ドライバの挙動が揃っていることを担保する（`.claude/rules/frontend.md`）。
 */
describe("IT: 総ページ数が未入力の書籍（実 Postgres）", () => {
  /** 総ページ数を未入力にした書籍を 1 冊作る。 */
  const createUnknownPagesBook = () => repository.createBook({ ...validBookBody, totalPages: 0 });

  // --- 正常系 ---
  it("総ページ数 0 で書籍を登録できる", async () => {
    const book = await createUnknownPagesBook();

    expect(book.totalPages).toBe(0);
    expect(book.status).toBe("reading");
  });

  it("明示的に completed へ更新できる（到達ページを問わない）", async () => {
    const book = await createUnknownPagesBook();

    const updated = await repository.updateBook(book.id, { status: "completed" });

    expect(updated.status).toBe("completed");
    expect(updated.completedAt).toEqual(expect.any(String));
  });

  it("completed の進捗ログを記録できる", async () => {
    const book = await createUnknownPagesBook();

    const { book: updated } = await repository.addProgressLog(book.id, {
      page: 12,
      memo: "",
      status: "completed",
    });

    expect(updated.status).toBe("completed");
    expect(updated.currentPage).toBe(12);
  });

  // --- 異常系: 自動確定に巻き込まれないこと（最重要の回帰） ---
  it("進捗を記録しても自動で完読にならない", async () => {
    const book = await createUnknownPagesBook();

    const { book: updated } = await repository.addProgressLog(book.id, {
      page: 0,
      memo: "",
      status: "reading",
    });

    expect(updated.status).toBe("reading");
  });

  it("currentPage を更新しても自動で完読にならない", async () => {
    const book = await createUnknownPagesBook();

    const updated = await repository.updateBook(book.id, { currentPage: 50 });

    expect(updated.status).toBe("reading");
    expect(updated.completedAt).toBeUndefined();
  });

  // --- 準正常系: 総ページ数が既知なら従来どおり ---
  it("総ページ数が既知なら到達で自動的に完読になる", async () => {
    const book = await repository.createBook({ ...validBookBody, totalPages: 100 });

    const updated = await repository.updateBook(book.id, { currentPage: 100 });

    expect(updated.status).toBe("completed");
  });
});
/**
 * 著者が未設定（空文字）の書籍の扱い。
 * `LocalStorageRepository` の UT と同じ観点を supabase ドライバ側でも固定し、
 * 両ドライバの挙動が揃っていることを担保する（`.claude/rules/frontend.md`）。
 *
 * `BookRecordBooks.author` は NOT NULL の `VarChar(120)` であり、null ではなく空文字で
 * 「未設定」を表す。**空文字が実 Postgres に保存できることは実 DB でしか確認できない**ため、
 * この観点を IT に置く。
 */
describe("IT: 著者が未設定の書籍（実 Postgres）", () => {
  // --- 正常系 ---
  it("著者を空文字にして書籍を登録できる", async () => {
    const book = await repository.createBook({ ...validBookBody, author: "" });

    expect(book.author).toBe("");

    // 取得し直しても空文字のまま（null へ化けない）ことを確認する。
    const fetched = await repository.getBook(book.id);
    expect(fetched?.author).toBe("");
  });

  it("空白のみの著者は trim して空文字で保存する", async () => {
    const book = await repository.createBook({ ...validBookBody, author: "   " });

    expect(book.author).toBe("");
  });

  it("既存書籍の著者を空文字へ更新できる", async () => {
    const book = await repository.createBook(validBookBody);
    expect(book.author).toBe(validBookBody.author);

    const updated = await repository.updateBook(book.id, { author: "" });

    expect(updated.author).toBe("");
  });

  it("上限境界（120 文字）の著者を保存できる", async () => {
    const book = await repository.createBook({ ...validBookBody, author: "a".repeat(120) });

    expect(book.author).toHaveLength(120);
  });

  // --- 準正常系: 上限は従来どおり効く ---
  it("121 文字の著者は検証エラーで DB に残らない", async () => {
    await expect(
      repository.createBook({ ...validBookBody, author: "a".repeat(121) })
    ).rejects.toThrow("著者は120文字以内で入力してください。");

    expect(await repository.listBooks()).toHaveLength(0);
  });
});
