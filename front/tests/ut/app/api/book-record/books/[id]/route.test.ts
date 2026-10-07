import { beforeEach, describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * `books/[id]` の GET（取得・未認証可）/ PATCH（更新・認証必須）/ DELETE（削除・認証必須）の
 * Route Handler UT。
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
    deleteBook: vi.fn(),
    requireAdmin: vi.fn(),
  };
});

vi.mock("@/lib/server/prisma-book-record-repository", () => ({
  PrismaBookRecordRepository: class {
    getBook = H.getBook;
    updateBook = H.updateBook;
    deleteBook = H.deleteBook;
  },
  RepositoryValidationError: H.RepositoryValidationError,
  RepositoryNotFoundError: H.RepositoryNotFoundError,
  isRepositoryError: (v: unknown) =>
    v instanceof H.RepositoryValidationError || v instanceof H.RepositoryNotFoundError,
}));

vi.mock("@/lib/server/auth-guard", () => ({
  requireAdmin: H.requireAdmin,
  AuthGuardError: H.AuthGuardError,
  isAuthGuardError: (v: unknown) => v instanceof H.AuthGuardError,
}));

import { DELETE, GET, PATCH } from "@/app/api/book-record/books/[id]/route";

// `request.json()` だけを持つ最小の NextRequest。
const jsonReq = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
// 動的ルートの params（Promise）を模した context。
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  H.getBook.mockReset();
  H.updateBook.mockReset();
  H.deleteBook.mockReset();
  H.requireAdmin.mockReset();
  H.requireAdmin.mockResolvedValue(undefined);
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
    H.requireAdmin.mockRejectedValue(new H.AuthGuardError("ログインが必要です。", 401));
    const res = await PATCH(jsonReq({ title: "new" }), ctx("b1"));
    expect(res.status).toBe(401);
    expect(H.updateBook).not.toHaveBeenCalled();
  });

  it("認証済みでも管理者以外（認可ガードが 403 を投げる）なら 403 で更新しない", async () => {
    H.requireAdmin.mockRejectedValue(new H.AuthGuardError("この操作を行う権限がありません。", 403));
    const res = await PATCH(jsonReq({ title: "new" }), ctx("b1"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "この操作を行う権限がありません。" });
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

describe("DELETE /api/book-record/books/[id]（認証必須）", () => {
  // --- 正常系 ---
  it("認証済みなら 200 で削除した ID を返す", async () => {
    H.deleteBook.mockResolvedValue(undefined);
    const res = await DELETE(jsonReq(null), ctx("b1"));

    expect(res.status).toBe(200);
    // 204 にしないのは、ApiRepository の共通ラッパーが必ず JSON をパースするため。
    await expect(res.json()).resolves.toEqual({ id: "b1" });
    expect(H.deleteBook).toHaveBeenCalledWith("b1");
  });

  it("リクエストボディを読まずに削除できる（DELETE はボディを持たない）", async () => {
    H.deleteBook.mockResolvedValue(undefined);
    // json() を呼ぶと落ちるリクエストを渡し、ハンドラーがボディを参照しないことを固定する。
    const noBodyReq = {
      json: async () => {
        throw new Error("body should not be read");
      },
    } as unknown as NextRequest;

    const res = await DELETE(noBodyReq, ctx("b1"));
    expect(res.status).toBe(200);
  });

  // --- 準正常系 ---
  it("未認証なら 401 で削除しない", async () => {
    H.requireAdmin.mockRejectedValue(new H.AuthGuardError("ログインが必要です。", 401));
    const res = await DELETE(jsonReq(null), ctx("b1"));

    expect(res.status).toBe(401);
    expect(H.deleteBook).not.toHaveBeenCalled();
  });

  it("認証済みでも管理者以外（認可ガードが 403 を投げる）なら 403 で削除しない", async () => {
    H.requireAdmin.mockRejectedValue(new H.AuthGuardError("この操作を行う権限がありません。", 403));
    const res = await DELETE(jsonReq(null), ctx("b1"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ message: "この操作を行う権限がありません。" });
    expect(H.deleteBook).not.toHaveBeenCalled();
  });

  it("リポジトリが未検出エラーを投げれば 404 に写像する", async () => {
    H.deleteBook.mockRejectedValue(new H.RepositoryNotFoundError("対象の書籍が見つかりません。"));
    const res = await DELETE(jsonReq(null), ctx("missing"));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ message: "対象の書籍が見つかりません。" });
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500 で内部情報を漏らさない", async () => {
    H.deleteBook.mockRejectedValue(new Error('relation "BookRecordBooks" does not exist'));
    const res = await DELETE(jsonReq(null), ctx("b1"));

    expect(res.status).toBe(500);
    // Prisma のメッセージをそのまま返さない（api.md「エラーレスポンスも整形する」）。
    await expect(res.json()).resolves.toEqual({ message: "書籍の削除に失敗しました。" });
  });
});
