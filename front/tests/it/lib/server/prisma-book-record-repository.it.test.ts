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
 * `updateBook` の感想同時更新は現在 Route Handler が `reflection` をパースしないため
 * API 経由では到達しない。リポジトリ層の契約としては生きているのでここで検証する。
 */
describe("IT: PrismaBookRecordRepository の監査列（実 Postgres）", () => {
  // --- 正常系 ---
  it("createBook は createdAt / updatedAt を自動採番する", async () => {
    const book = await repository.createBook(validBookBody);

    expect(Number.isNaN(new Date(book.createdAt).getTime())).toBe(false);
    expect(Number.isNaN(new Date(book.updatedAt).getTime())).toBe(false);
  });

  it("updateBook は感想を作成し createdAt を自動採番する", async () => {
    const id = await seedBook();

    const updated = await repository.updateBook(id, {
      reflection: { learning: "学び", action: "行動", quote: "引用", createdAt: "" },
    });

    expect(updated.reflection).toMatchObject({ learning: "学び", action: "行動", quote: "引用" });
    // 引数の createdAt（空文字）は採用されず、DB 側の @default(now()) が採番する。
    expect(Number.isNaN(new Date(updated.reflection!.createdAt).getTime())).toBe(false);
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
