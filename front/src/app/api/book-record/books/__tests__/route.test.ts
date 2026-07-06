import { beforeEach, describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Route Handler UT のハーネス。外部 I/O 境界（Prisma リポジトリ・認証ガード）だけをモックし、
 * ハンドラー自身の責務（認可分岐・入力検証・エラー→HTTP ステータス写像）を検証する。
 *
 * エラークラスは `vi.hoisted` 内に定義し、`vi.mock` ファクトリとテストが throw する側で
 * 同一 identity を共有する（ルート内部の `instanceof` 判定が成立するため）。
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
    listBooks: vi.fn(),
    createBook: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
  };
});

vi.mock("@/lib/server/prisma-book-record-repository", () => ({
  PrismaBookRecordRepository: class {
    listBooks = H.listBooks;
    createBook = H.createBook;
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

import { GET, POST } from "../route";

// `request.json()` だけを持つ最小の NextRequest を作る（body は任意の JSON 値）。
const jsonReq = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;

// 妥当な CreateBookInput ボディ。個別テストで一部を壊して準正常系を作る。
const validBody = {
  title: "t",
  author: "a",
  genre: "g",
  format: "paper",
  totalPages: 100,
  tags: ["x"],
  status: "reading",
};

beforeEach(() => {
  H.listBooks.mockReset();
  H.createBook.mockReset();
  H.requireAuthenticatedUser.mockReset();
  H.requireAuthenticatedUser.mockResolvedValue(undefined);
});

describe("GET /api/book-record/books（未認証可）", () => {
  // --- 正常系 ---
  it("一覧を取得して 200 で books を返す", async () => {
    H.listBooks.mockResolvedValue([{ id: "b1" }]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ books: [{ id: "b1" }] });
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500", async () => {
    H.listBooks.mockRejectedValue(new Error("db down"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/book-record/books（認証必須）", () => {
  // --- 正常系 ---
  it("認証済み・妥当なボディで 201 と作成書籍を返す", async () => {
    H.createBook.mockResolvedValue({ id: "b1", ...validBody });
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ book: { id: "b1", ...validBody } });
    expect(H.createBook).toHaveBeenCalledWith(expect.objectContaining({ title: "t" }));
  });

  // --- 準正常系 ---
  it("未認証（認証ガードが 401 を投げる）なら 401 で作成しない", async () => {
    H.requireAuthenticatedUser.mockRejectedValue(new H.AuthGuardError("ログインが必要です。", 401));
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(401);
    expect(H.createBook).not.toHaveBeenCalled();
  });

  it("ボディが非オブジェクトなら 400 で作成しない", async () => {
    const res = await POST(jsonReq(null));
    expect(res.status).toBe(400);
    expect(H.createBook).not.toHaveBeenCalled();
  });

  it("必須フィールド欠落（totalPages なし）なら 400", async () => {
    const noPages = { ...validBody, totalPages: undefined };
    const res = await POST(jsonReq(noPages));
    expect(res.status).toBe(400);
    expect(H.createBook).not.toHaveBeenCalled();
  });

  it("列挙外の status なら 400", async () => {
    const res = await POST(jsonReq({ ...validBody, status: "unknown" }));
    expect(res.status).toBe(400);
    expect(H.createBook).not.toHaveBeenCalled();
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500", async () => {
    H.createBook.mockRejectedValue(new Error("db down"));
    const res = await POST(jsonReq(validBody));
    expect(res.status).toBe(500);
  });
});
