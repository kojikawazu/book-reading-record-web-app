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

const ADMIN = "admin@example.com";

// env の有無を切り替えて auth-guard を再読み込みする（serverAuthClient / adminEmail は import 時に決まるため）。
// adminEmail を省略すると ADMIN_EMAIL は ADMIN、null を渡すと未設定になる。
const loadGuard = async (withEnv: boolean, adminEmail: string | null = ADMIN) => {
  vi.resetModules();
  if (withEnv) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  if (adminEmail === null) {
    delete process.env.ADMIN_EMAIL;
  } else {
    process.env.ADMIN_EMAIL = adminEmail;
  }
  return import("@/lib/server/auth-guard");
};

// getUser が指定メールのユーザーを返すようにする。
const resolveUserWithEmail = (email: string | undefined) => {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email } }, error: null });
};

beforeEach(() => {
  mockGetUser.mockReset();
});

describe("requireAdmin", () => {
  // --- 正常系 ---
  it("有効なトークンのユーザーが ADMIN_EMAIL と一致すれば通過する", async () => {
    const guard = await loadGuard(true);
    resolveUserWithEmail(ADMIN);
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).resolves.toBeUndefined();
  });

  it("メールの大文字小文字・前後空白の違いは同一とみなして通過する", async () => {
    const guard = await loadGuard(true, "  Admin@Example.com ");
    resolveUserWithEmail("ADMIN@example.COM");
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).resolves.toBeUndefined();
  });

  // --- 準正常系 ---
  it("Authorization ヘッダなしは 401", async () => {
    const guard = await loadGuard(true);
    await expect(guard.requireAdmin(reqWith(null))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("Bearer 以外のスキームは 401", async () => {
    const guard = await loadGuard(true);
    await expect(guard.requireAdmin(reqWith("Basic abc"))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("トークンが空白のみは 401", async () => {
    const guard = await loadGuard(true);
    await expect(guard.requireAdmin(reqWith("Bearer    "))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("トークン検証でユーザーを解決できなければ 401", async () => {
    const guard = await loadGuard(true);
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid" } });
    await expect(guard.requireAdmin(reqWith("Bearer bad"))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("有効なトークンでも ADMIN_EMAIL と一致しないユーザーは 403", async () => {
    const guard = await loadGuard(true);
    resolveUserWithEmail("someone@example.com");
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).rejects.toMatchObject({
      statusCode: 403,
      message: "この操作を行う権限がありません。",
    });
  });

  it("メールアドレスを持たないユーザーは 403", async () => {
    const guard = await loadGuard(true);
    resolveUserWithEmail(undefined);
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("ADMIN_EMAIL を部分一致で通さない（前方一致のアドレスは 403）", async () => {
    const guard = await loadGuard(true);
    resolveUserWithEmail(`${ADMIN}.evil.test`);
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  // --- 異常系 ---
  it("Supabase の環境変数が不足していれば 500", async () => {
    const guard = await loadGuard(false);
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it("ADMIN_EMAIL が未設定なら、トークンが有効でも 500 で拒否しトークン検証も行わない", async () => {
    const guard = await loadGuard(true, null);
    resolveUserWithEmail(ADMIN);
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).rejects.toMatchObject({
      statusCode: 500,
    });
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("ADMIN_EMAIL が空白のみなら 500（空メールのユーザーと一致させない）", async () => {
    const guard = await loadGuard(true, "   ");
    resolveUserWithEmail("");
    await expect(guard.requireAdmin(reqWith("Bearer valid"))).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
