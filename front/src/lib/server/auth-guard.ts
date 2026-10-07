import "server-only";

import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const serverAuthClient =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

// 書き込みを許可する唯一のメールアドレス（単一ユーザー MVP のため 1 件のみ）。
// 比較は前後空白を除いた小文字で行う。未設定・空文字は「設定不備」として扱い、全書き込みを拒否する。
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";

/** 認証ガード失敗を表すエラー。Route Handler で対応する HTTP ステータスに変換する。 */
export class AuthGuardError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * 値が AuthGuardError かどうかを判定する型ガード。
 *
 * @param value - 判定対象の値
 * @returns AuthGuardError なら true
 */
export const isAuthGuardError = (value: unknown): value is AuthGuardError => {
  return value instanceof AuthGuardError;
};

/**
 * 更新系エンドポイントの認可ガード。`Authorization: Bearer <token>` を Supabase Auth で検証し、
 * 解決したユーザーのメールアドレスが `ADMIN_EMAIL` と一致する場合のみ通過させる。
 * トークンが有効でも管理者以外は拒否する（docs/06-security-specification.md §6）。
 *
 * @param request - 受信リクエスト
 * @throws {AuthGuardError} 環境変数不足（500）・トークン欠落や無効（401）・管理者以外（403）の場合
 */
export const requireAdmin = async (request: NextRequest): Promise<void> => {
  if (!serverAuthClient || !adminEmail) {
    throw new AuthGuardError("認証設定が不足しています。", 500);
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new AuthGuardError("ログインが必要です。", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) {
    throw new AuthGuardError("ログインが必要です。", 401);
  }

  const { data, error } = await serverAuthClient.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthGuardError("ログインが必要です。", 401);
  }

  const userEmail = data.user.email?.trim().toLowerCase() ?? "";
  if (userEmail !== adminEmail) {
    throw new AuthGuardError("この操作を行う権限がありません。", 403);
  }
};
