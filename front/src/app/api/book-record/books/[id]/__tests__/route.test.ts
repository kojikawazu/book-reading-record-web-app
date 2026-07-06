import { beforeEach, describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * `books/[id]` の GET（取得・未認証可）/ PATCH（更新・認証必須）の Route Handler UT。
 * エラークラスは `vi.hoisted` 内に定義し、`instanceof` の identity をルートと共有する。
 */
const H = vi.hoisted(() => {
  class RepositoryValidationError extends Error {
    readonly statusCode = 400;
  }
  class RepositoryNotFoundError extends Error {
    readonly statusCode = 404;
  }
  class AuthGuardError extends Error {
    readonly statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  }
  return {
    RepositoryValidationError,
    RepositoryNotFoundError,
    AuthGuardError,
    getBook: vi.fn(),
    updateBook: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
  };
});

vi.mock("@/lib/server/prisma-book-record-repository", () => ({
  PrismaBookRecordRepository: class {
    getBook = H.getBook;
    updateBook = H.updateBook;
  },
  RepositoryValidationError: H.RepositoryValidationError,
  RepositoryNotFoundError: H.RepositoryNotFoundError,
  isRepositoryError: (v: unknown) =>
    v instanceof H.RepositoryValidationError || v instanceof H.RepositoryNotFoundError,
}));

vi.mock("@/lib/server/auth-guard", () => ({
  requireAuthenticatedUser: H.requireAuthenticatedUser,
  AuthGuardError: H.AuthGuardError,
  isAuthGuardError: (v: unknown) => v instanceof H.AuthGuardError,
}));

import { GET, PATCH } from "../route";

// `request.json()` だけを持つ最小の NextRequest。
const jsonReq = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
// 動的ルートの params（Promise）を模した context。
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  H.getBook.mockReset();
  H.updateBook.mockReset();
  H.requireAuthenticatedUser.mockReset();
  H.requireAuthenticatedUser.mockResolvedValue(undefined);
});

describe("GET /api/book-record/books/[id]（未認証可）", () => {
  // --- 正常系 ---
  it("存在する書籍を 200 で返す", async () => {
    H.getBook.mockResolvedValue({ id: "b1" });
    const res = await GET(jsonReq(null), ctx("b1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ book: { id: "b1" } });
    expect(H.getBook).toHaveBeenCalledWith("b1");
  });

  // --- 準正常系 ---
  it("未検出（null）なら 404", async () => {
    H.getBook.mockResolvedValue(null);
    const res = await GET(jsonReq(null), ctx("missing"));
    expect(res.status).toBe(404);
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500", async () => {
    H.getBook.mockRejectedValue(new Error("db down"));
    const res = await GET(jsonReq(null), ctx("b1"));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/book-record/books/[id]（認証必須）", () => {
  // --- 正常系 ---
  it("認証済み・妥当なパッチで 200 と更新後書籍を返す", async () => {
    H.updateBook.mockResolvedValue({ id: "b1", title: "new" });
    const res = await PATCH(jsonReq({ title: "new" }), ctx("b1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ book: { id: "b1", title: "new" } });
    expect(H.updateBook).toHaveBeenCalledWith("b1", { title: "new" });
  });

  it("認識できないフィールドは無視して採用フィールドのみ渡す", async () => {
    H.updateBook.mockResolvedValue({ id: "b1" });
    await PATCH(jsonReq({ title: "new", bogus: 1, totalPages: "x" }), ctx("b1"));
    expect(H.updateBook).toHaveBeenCalledWith("b1", { title: "new" });
  });

  // --- 準正常系 ---
  it("未認証なら 401 で更新しない", async () => {
    H.requireAuthenticatedUser.mockRejectedValue(new H.AuthGuardError("ログインが必要です。", 401));
    const res = await PATCH(jsonReq({ title: "new" }), ctx("b1"));
    expect(res.status).toBe(401);
    expect(H.updateBook).not.toHaveBeenCalled();
  });

  it("ボディが非オブジェクトなら 400 で更新しない", async () => {
    const res = await PATCH(jsonReq(null), ctx("b1"));
    expect(res.status).toBe(400);
    expect(H.updateBook).not.toHaveBeenCalled();
  });

  it("リポジトリが未検出エラーを投げれば 404 に写像する", async () => {
    H.updateBook.mockRejectedValue(new H.RepositoryNotFoundError("対象の書籍が見つかりません。"));
    const res = await PATCH(jsonReq({ title: "new" }), ctx("missing"));
    expect(res.status).toBe(404);
  });

  it("リポジトリが検証エラーを投げれば 400 に写像する", async () => {
    H.updateBook.mockRejectedValue(new H.RepositoryValidationError("現在ページが不正です。"));
    const res = await PATCH(jsonReq({ currentPage: -1 }), ctx("b1"));
    expect(res.status).toBe(400);
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500", async () => {
    H.updateBook.mockRejectedValue(new Error("db down"));
    const res = await PATCH(jsonReq({ title: "new" }), ctx("b1"));
    expect(res.status).toBe(500);
  });
});
