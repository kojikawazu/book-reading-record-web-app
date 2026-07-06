import { beforeEach, describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * `books/[id]/reflection` の POST（完読時感想の保存・認証必須）の Route Handler UT。
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
    saveReflection: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
  };
});

vi.mock("@/lib/server/prisma-book-record-repository", () => ({
  PrismaBookRecordRepository: class {
    saveReflection = H.saveReflection;
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

import { POST } from "../route";

// `request.json()` だけを持つ最小の NextRequest。
const jsonReq = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
// 動的ルートの params（Promise）を模した context。
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

// 妥当な感想ボディ。各フィールドは空文字も許容されるため、型のみが検証対象。
const validBody = { learning: "l", action: "a", quote: "q" };

beforeEach(() => {
  H.saveReflection.mockReset();
  H.requireAuthenticatedUser.mockReset();
  H.requireAuthenticatedUser.mockResolvedValue(undefined);
});

describe("POST /api/book-record/books/[id]/reflection（認証必須）", () => {
  // --- 正常系 ---
  it("認証済み・妥当なボディで 200 と更新後書籍を返す", async () => {
    H.saveReflection.mockResolvedValue({ id: "b1" });
    const res = await POST(jsonReq(validBody), ctx("b1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ book: { id: "b1" } });
    expect(H.saveReflection).toHaveBeenCalledWith("b1", validBody);
  });

  it("各フィールドが空文字でも 200（未記入は空文字で保存する仕様）", async () => {
    H.saveReflection.mockResolvedValue({ id: "b1" });
    const res = await POST(jsonReq({ learning: "", action: "", quote: "" }), ctx("b1"));
    expect(res.status).toBe(200);
  });

  // --- 準正常系 ---
  it("未認証なら 401 で保存しない", async () => {
    H.requireAuthenticatedUser.mockRejectedValue(new H.AuthGuardError("ログインが必要です。", 401));
    const res = await POST(jsonReq(validBody), ctx("b1"));
    expect(res.status).toBe(401);
    expect(H.saveReflection).not.toHaveBeenCalled();
  });

  it("learning が文字列でなければ 400 で保存しない", async () => {
    const res = await POST(jsonReq({ ...validBody, learning: 1 }), ctx("b1"));
    expect(res.status).toBe(400);
    expect(H.saveReflection).not.toHaveBeenCalled();
  });

  it("ボディが非オブジェクトなら 400", async () => {
    const res = await POST(jsonReq(null), ctx("b1"));
    expect(res.status).toBe(400);
    expect(H.saveReflection).not.toHaveBeenCalled();
  });

  it("リポジトリが未検出エラーを投げれば 404 に写像する", async () => {
    H.saveReflection.mockRejectedValue(new H.RepositoryNotFoundError("対象の書籍が見つかりません。"));
    const res = await POST(jsonReq(validBody), ctx("missing"));
    expect(res.status).toBe(404);
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500", async () => {
    H.saveReflection.mockRejectedValue(new Error("db down"));
    const res = await POST(jsonReq(validBody), ctx("b1"));
    expect(res.status).toBe(500);
  });
});
