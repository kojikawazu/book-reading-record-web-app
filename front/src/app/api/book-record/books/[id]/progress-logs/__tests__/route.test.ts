import { beforeEach, describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * `books/[id]/progress-logs` の GET（履歴・未認証可）/ POST（進捗追加・認証必須）の Route Handler UT。
 * 負数ページ等の業務検証はリポジトリ層（実 Postgres）で行うため IT の担当。UT は
 * ハンドラーの入力検証（型・列挙）と、リポジトリ検証エラーの 400 写像を検証する。
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
    listProgressLogs: vi.fn(),
    addProgressLog: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
  };
});

vi.mock("@/lib/server/prisma-book-record-repository", () => ({
  PrismaBookRecordRepository: class {
    listProgressLogs = H.listProgressLogs;
    addProgressLog = H.addProgressLog;
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

// `request.json()` だけを持つ最小の NextRequest。
const jsonReq = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
// 動的ルートの params（Promise）を模した context。
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

// 妥当な進捗ボディ。個別テストで一部を壊して準正常系を作る。
const validBody = { page: 10, memo: "m", status: "reading" };

beforeEach(() => {
  H.listProgressLogs.mockReset();
  H.addProgressLog.mockReset();
  H.requireAuthenticatedUser.mockReset();
  H.requireAuthenticatedUser.mockResolvedValue(undefined);
});

describe("GET /api/book-record/books/[id]/progress-logs（未認証可）", () => {
  // --- 正常系 ---
  it("履歴を 200 で返す", async () => {
    H.listProgressLogs.mockResolvedValue([{ id: "p1" }]);
    const res = await GET(jsonReq(null), ctx("b1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ logs: [{ id: "p1" }] });
    expect(H.listProgressLogs).toHaveBeenCalledWith("b1");
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500", async () => {
    H.listProgressLogs.mockRejectedValue(new Error("db down"));
    const res = await GET(jsonReq(null), ctx("b1"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/book-record/books/[id]/progress-logs（認証必須）", () => {
  // --- 正常系 ---
  it("認証済み・妥当なボディで 201 と payload を返す", async () => {
    H.addProgressLog.mockResolvedValue({ book: { id: "b1" }, log: { id: "p1" } });
    const res = await POST(jsonReq(validBody), ctx("b1"));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ book: { id: "b1" }, log: { id: "p1" } });
    expect(H.addProgressLog).toHaveBeenCalledWith("b1", expect.objectContaining({ page: 10 }));
  });

  // --- 準正常系 ---
  it("未認証なら 401 で登録しない", async () => {
    H.requireAuthenticatedUser.mockRejectedValue(new H.AuthGuardError("ログインが必要です。", 401));
    const res = await POST(jsonReq(validBody), ctx("b1"));
    expect(res.status).toBe(401);
    expect(H.addProgressLog).not.toHaveBeenCalled();
  });

  it("page が数値でなければ 400 で登録しない", async () => {
    const res = await POST(jsonReq({ ...validBody, page: "10" }), ctx("b1"));
    expect(res.status).toBe(400);
    expect(H.addProgressLog).not.toHaveBeenCalled();
  });

  it("列挙外の status なら 400", async () => {
    const res = await POST(jsonReq({ ...validBody, status: "unknown" }), ctx("b1"));
    expect(res.status).toBe(400);
    expect(H.addProgressLog).not.toHaveBeenCalled();
  });

  it("リポジトリが検証エラー（負数ページ等）を投げれば 400 に写像する", async () => {
    H.addProgressLog.mockRejectedValue(new H.RepositoryValidationError("ページ数が不正です。"));
    const res = await POST(jsonReq(validBody), ctx("b1"));
    expect(res.status).toBe(400);
  });

  // --- 異常系 ---
  it("リポジトリが想定外エラーなら 500", async () => {
    H.addProgressLog.mockRejectedValue(new Error("db down"));
    const res = await POST(jsonReq(validBody), ctx("b1"));
    expect(res.status).toBe(500);
  });
});
