import { beforeEach, describe, it, expect } from "vitest";
import { LocalStorageRepository } from "@/repositories/local-storage-repository";
import { CreateBookInput } from "@/types/book";

const baseInput: CreateBookInput = {
  title: "  リーダブルコード  ",
  author: "  Boswell  ",
  genre: "  技術書  ",
  format: "paper",
  totalPages: 100,
  tags: ["clean"],
  status: "reading",
};

let repo: LocalStorageRepository;

beforeEach(() => {
  window.localStorage.clear();
  repo = new LocalStorageRepository();
});

describe("createBook", () => {
  // --- 正常系 ---
  it("currentPage=0 で作成し、title/author/genre を trim する", async () => {
    const book = await repo.createBook(baseInput);
    expect(book.currentPage).toBe(0);
    expect(book.title).toBe("リーダブルコード");
    expect(book.author).toBe("Boswell");
    expect(book.genre).toBe("技術書");
    expect(book.status).toBe("reading");
    expect(book.id.length).toBeGreaterThan(0);
  });

  it("空 genre は undefined になる", async () => {
    const book = await repo.createBook({ ...baseInput, genre: "   " });
    expect(book.genre).toBeUndefined();
  });

  it("空 author は空文字のまま保持する（undefined にしない）", async () => {
    // author は DB が NOT NULL のため、genre と違い undefined へ落とさず空文字で「未設定」を表す。
    const book = await repo.createBook({ ...baseInput, author: "   " });
    expect(book.author).toBe("");
  });

  it("作成した書籍は一覧・取得で参照できる", async () => {
    const created = await repo.createBook(baseInput);
    expect(await repo.listBooks()).toHaveLength(1);
    expect((await repo.getBook(created.id))?.id).toBe(created.id);
  });

  it("存在しない ID の取得は null", async () => {
    expect(await repo.getBook("missing")).toBeNull();
  });
});

describe("updateBook", () => {
  // --- 正常系 ---
  it("currentPage が総ページ到達で completed を自動確定し completedAt を付与する", async () => {
    const book = await repo.createBook(baseInput);
    const updated = await repo.updateBook(book.id, { currentPage: 100 });
    expect(updated.status).toBe("completed");
    expect(updated.completedAt).toBeDefined();
  });

  it("再読（reading へ戻す）で completedAt を解除し reflection は保持する", async () => {
    const book = await repo.createBook(baseInput);
    await repo.updateBook(book.id, { currentPage: 100 });
    await repo.saveReflection(book.id, { learning: "学び", action: "", quote: "" });

    const reread = await repo.updateBook(book.id, {
      status: "reading",
      currentPage: 0,
      completedAt: undefined,
    });
    expect(reread.status).toBe("reading");
    expect(reread.completedAt).toBeUndefined();
    expect(reread.reflection?.learning).toBe("学び");
  });

  it("author に空文字を渡すと未設定へ戻せる", async () => {
    const book = await repo.createBook(baseInput);
    expect(book.author).toBe("Boswell");

    const updated = await repo.updateBook(book.id, { author: "" });
    expect(updated.author).toBe("");
  });

  // --- 準正常系 ---
  it("総ページ未満で completed 指定は保存エラー", async () => {
    const book = await repo.createBook(baseInput);
    await expect(
      repo.updateBook(book.id, { status: "completed", currentPage: 50 })
    ).rejects.toThrow("完読にするには到達ページを総ページ以上にしてください。");
  });

  // --- 異常系 ---
  it("存在しない書籍の更新はエラー", async () => {
    await expect(repo.updateBook("missing", {})).rejects.toThrow("対象の書籍が見つかりません。");
  });
});

describe("addProgressLog", () => {
  // --- 正常系 ---
  it("進捗を記録して currentPage を更新し、履歴を1件追加する", async () => {
    const book = await repo.createBook(baseInput);
    const { book: updated } = await repo.addProgressLog(book.id, { page: 50, status: "reading" });
    expect(updated.currentPage).toBe(50);
    expect(await repo.listProgressLogs(book.id)).toHaveLength(1);
  });

  it("到達ページが総ページ以上なら completed を自動確定する", async () => {
    const book = await repo.createBook(baseInput);
    const { book: updated } = await repo.addProgressLog(book.id, { page: 100, status: "reading" });
    expect(updated.status).toBe("completed");
  });

  // --- 準正常系 ---
  it("総ページ未満で completed 指定は保存エラー", async () => {
    const book = await repo.createBook(baseInput);
    await expect(repo.addProgressLog(book.id, { page: 50, status: "completed" })).rejects.toThrow(
      "完読にするには到達ページを総ページ以上にしてください。"
    );
  });

  // --- 異常系 ---
  it("存在しない書籍への進捗記録はエラー", async () => {
    await expect(repo.addProgressLog("missing", { page: 1, status: "reading" })).rejects.toThrow(
      "対象の書籍が見つかりません。"
    );
  });
});

describe("saveReflection", () => {
  // --- 正常系 ---
  it("感想を保存し、上書き時も作成日時を保持する", async () => {
    const book = await repo.createBook(baseInput);
    const first = await repo.saveReflection(book.id, { learning: "初回", action: "", quote: "" });
    const createdAt = first.reflection?.createdAt;

    const second = await repo.saveReflection(book.id, {
      learning: "上書き",
      action: "",
      quote: "",
    });
    expect(second.reflection?.learning).toBe("上書き");
    expect(second.reflection?.createdAt).toBe(createdAt);
  });

  // --- 準正常系 ---
  it("上限超過の感想は保存エラー", async () => {
    const book = await repo.createBook(baseInput);
    await expect(
      repo.saveReflection(book.id, { learning: "a".repeat(5001), action: "", quote: "" })
    ).rejects.toThrow("学びは5000文字以内で入力してください。");
  });

  // --- 異常系 ---
  it("存在しない書籍への感想保存はエラー", async () => {
    await expect(
      repo.saveReflection("missing", { learning: "", action: "", quote: "" })
    ).rejects.toThrow("対象の書籍が見つかりません。");
  });
});

describe("searchBooks", () => {
  beforeEach(async () => {
    await repo.createBook({ ...baseInput, title: "Rust入門", author: "Klabnik", tags: ["rust"] });
    await repo.createBook({ ...baseInput, title: "Go言語", author: "Donovan", tags: ["go"] });
  });

  // --- 正常系 ---
  it("著者の部分一致で絞り込む", async () => {
    const result = await repo.searchBooks("klab");
    expect(result.map((b) => b.title)).toEqual(["Rust入門"]);
  });

  it("タグの部分一致で絞り込む", async () => {
    expect((await repo.searchBooks("go")).map((b) => b.title)).toContain("Go言語");
  });

  it("空クエリは全件返す", async () => {
    expect(await repo.searchBooks("  ")).toHaveLength(2);
  });

  // --- 準正常系 ---
  it("一致しないクエリは空配列", async () => {
    expect(await repo.searchBooks("zzz-none")).toEqual([]);
  });
});

describe("総ページ数が未入力（TOTAL_PAGES_UNKNOWN）の書籍", () => {
  /** 総ページ数を未入力にした書籍を 1 冊作る。 */
  const createUnknownPagesBook = () => repo.createBook({ ...baseInput, totalPages: 0 });

  // --- 正常系 ---
  it("総ページ数 0 で書籍を登録できる", async () => {
    const book = await createUnknownPagesBook();
    expect(book.totalPages).toBe(0);
    expect(book.status).toBe("reading");
  });

  it("明示的に completed へ更新できる（到達ページを問わない）", async () => {
    const book = await createUnknownPagesBook();

    const updated = await repo.updateBook(book.id, { status: "completed" });

    expect(updated.status).toBe("completed");
    expect(updated.completedAt).toEqual(expect.any(String));
  });

  it("completed の進捗ログを記録できる", async () => {
    const book = await createUnknownPagesBook();

    const { book: updated } = await repo.addProgressLog(book.id, {
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

    const { book: updated } = await repo.addProgressLog(book.id, {
      page: 0,
      memo: "",
      status: "reading",
    });

    // 0 を分母とみなすと page >= totalPages が常に成立し、全書籍が完読になってしまう。
    expect(updated.status).toBe("reading");
  });

  it("currentPage を更新しても自動で完読にならない", async () => {
    const book = await createUnknownPagesBook();

    const updated = await repo.updateBook(book.id, { currentPage: 50 });

    expect(updated.status).toBe("reading");
    expect(updated.completedAt).toBeUndefined();
  });
});
