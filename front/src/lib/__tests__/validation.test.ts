import { describe, it, expect } from "vitest";
import {
  normalizeTags,
  validateBookForm,
  validateProgressForm,
  validateReflection,
} from "../validation";

const validBookInput = {
  title: "リーダブルコード",
  author: "Dustin Boswell",
  genre: "技術書",
  totalPages: 260,
  tags: ["programming", "clean-code"],
  status: "not_started" as const,
};

describe("normalizeTags", () => {
  // --- 正常系 ---
  it("カンマ区切りを trim して配列化する", () => {
    expect(normalizeTags("react, typescript ,  next ")).toEqual(["react", "typescript", "next"]);
  });

  // --- 準正常系 ---
  it("空要素・空白のみ要素を除去する", () => {
    expect(normalizeTags("a,,  , b")).toEqual(["a", "b"]);
  });

  it("空文字入力は空配列を返す", () => {
    expect(normalizeTags("")).toEqual([]);
  });
});

describe("validateBookForm", () => {
  // --- 正常系 ---
  it("妥当な入力はエラーなし", () => {
    expect(validateBookForm(validBookInput)).toEqual({});
  });

  it("境界値（title 1文字・totalPages 1・tags 10件）を許容する", () => {
    const errors = validateBookForm({
      ...validBookInput,
      title: "a",
      totalPages: 1,
      tags: Array.from({ length: 10 }, (_, i) => `t${i}`),
    });
    expect(errors).toEqual({});
  });

  it("上限境界（title 200・author 120・genre 80・totalPages 100000）を許容する", () => {
    const errors = validateBookForm({
      ...validBookInput,
      title: "a".repeat(200),
      author: "b".repeat(120),
      genre: "c".repeat(80),
      totalPages: 100000,
    });
    expect(errors).toEqual({});
  });

  // --- 準正常系 ---
  it("title が空ならエラー", () => {
    expect(validateBookForm({ ...validBookInput, title: "   " }).title).toBe(
      "タイトルは1〜200文字で入力してください。"
    );
  });

  it("title が 201 文字ならエラー", () => {
    expect(validateBookForm({ ...validBookInput, title: "a".repeat(201) }).title).toBeDefined();
  });

  it("author が空・121 文字ならエラー", () => {
    expect(validateBookForm({ ...validBookInput, author: "" }).author).toBeDefined();
    expect(validateBookForm({ ...validBookInput, author: "a".repeat(121) }).author).toBeDefined();
  });

  it("genre が 81 文字ならエラー", () => {
    expect(validateBookForm({ ...validBookInput, genre: "g".repeat(81) }).genre).toBe(
      "ジャンルは80文字以内で入力してください。"
    );
  });

  it("totalPages が 0・100001 ならエラー", () => {
    expect(validateBookForm({ ...validBookInput, totalPages: 0 }).totalPages).toBeDefined();
    expect(validateBookForm({ ...validBookInput, totalPages: 100001 }).totalPages).toBeDefined();
  });

  it("totalPages が非整数ならエラー", () => {
    expect(validateBookForm({ ...validBookInput, totalPages: 12.5 }).totalPages).toBeDefined();
  });

  it("tags が 11 件ならエラー", () => {
    const errors = validateBookForm({
      ...validBookInput,
      tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
    });
    expect(errors.tags).toBe("タグは最大10件までです。");
  });

  it("tag が 31 文字ならエラー", () => {
    expect(validateBookForm({ ...validBookInput, tags: ["a".repeat(31)] }).tags).toBe(
      "タグは1〜30文字で入力してください。"
    );
  });

  // --- 異常系 ---
  it("初期ステータスに completed は指定できない", () => {
    expect(validateBookForm({ ...validBookInput, status: "completed" }).status).toBe(
      "初期ステータスに完読は指定できません。"
    );
  });
});

describe("validateProgressForm", () => {
  const base = { page: 100, totalPages: 260, status: "reading" as const, memo: "" };

  // --- 正常系 ---
  it("妥当な進捗入力はエラーなし", () => {
    expect(validateProgressForm(base)).toEqual({});
  });

  it("page が総ページ以上かつ completed は整合（エラーなし）", () => {
    expect(validateProgressForm({ ...base, page: 260, status: "completed" })).toEqual({});
  });

  // --- 準正常系 ---
  it("page が負数ならエラー", () => {
    expect(validateProgressForm({ ...base, page: -1 }).page).toBe(
      "到達ページは0〜100000の整数で入力してください。"
    );
  });

  it("page が非整数・100001 ならエラー", () => {
    expect(validateProgressForm({ ...base, page: 3.5 }).page).toBeDefined();
    expect(validateProgressForm({ ...base, page: 100001 }).page).toBeDefined();
  });

  it("memo が 5001 文字ならエラー", () => {
    expect(validateProgressForm({ ...base, memo: "m".repeat(5001) }).memo).toBeDefined();
  });

  // --- 異常系 ---
  it("page が総ページ未満なのに completed を選ぶと状態エラー", () => {
    expect(validateProgressForm({ ...base, page: 100, status: "completed" }).status).toBe(
      "完読にするには到達ページを総ページ以上にしてください。"
    );
  });
});

describe("validateReflection", () => {
  const base = { learning: "", action: "", quote: "" };

  // --- 正常系 ---
  it("3項目すべて空でもエラーなし（空入力可）", () => {
    expect(validateReflection(base)).toEqual({});
  });

  it("上限 5000 文字ちょうどはエラーなし", () => {
    expect(validateReflection({ ...base, learning: "a".repeat(5000) })).toEqual({});
  });

  // --- 準正常系 ---
  it("learning/action/quote が 5001 文字ならそれぞれエラー", () => {
    expect(validateReflection({ ...base, learning: "a".repeat(5001) }).learning).toBeDefined();
    expect(validateReflection({ ...base, action: "a".repeat(5001) }).action).toBeDefined();
    expect(validateReflection({ ...base, quote: "a".repeat(5001) }).quote).toBeDefined();
  });
});
