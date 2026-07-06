import { beforeEach, describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

// Supabase クライアント（外部 I/O）をモックし、トークン検証結果を制御する。
const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));

// authorization ヘッダだけを持つ最小の NextRequest を作る。
const reqWith = (authorization: string | null) =>
  ({
    headers: { get: (key: string) => (key === "authorization" ? authorization : null) },
  }) as unknown as NextRequest;

// env の有無を切り替えて auth-guard を再読み込みする（serverAuthClient は import 時に決まるため）。
const loadGuard = async (withEnv: boolean) => {
  vi.resetModules();
  if (withEnv) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  return import("../auth-guard");
};

beforeEach(() => {
  mockGetUser.mockReset();
});

describe("requireAuthenticatedUser", () => {
  // --- 正常系 ---
  it("有効な Bearer トークンでユーザーを解決できれば通過する", async () => {
    const guard = await loadGuard(true);
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await expect(guard.requireAuthenticatedUser(reqWith("Bearer valid"))).resolves.toBeUndefined();
  });

  // --- 準正常系 ---
  it("Authorization ヘッダなしは 401", async () => {
    const guard = await loadGuard(true);
    await expect(guard.requireAuthenticatedUser(reqWith(null))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("Bearer 以外のスキームは 401", async () => {
    const guard = await loadGuard(true);
    await expect(guard.requireAuthenticatedUser(reqWith("Basic abc"))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("トークンが空白のみは 401", async () => {
    const guard = await loadGuard(true);
    await expect(guard.requireAuthenticatedUser(reqWith("Bearer    "))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("トークン検証でユーザーを解決できなければ 401", async () => {
    const guard = await loadGuard(true);
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    await expect(guard.requireAuthenticatedUser(reqWith("Bearer bad"))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  // --- 異常系 ---
  it("環境変数が不足していれば 500", async () => {
    const guard = await loadGuard(false);
    await expect(guard.requireAuthenticatedUser(reqWith("Bearer valid"))).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
