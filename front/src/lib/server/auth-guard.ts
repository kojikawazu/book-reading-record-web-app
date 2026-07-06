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
 * 更新系エンドポイントの認証ガード。`Authorization: Bearer <token>` を検証し、
 * Supabase Auth でユーザーを解決できなければ拒否する。
 *
 * @param request - 受信リクエスト
 * @throws {AuthGuardError} 環境変数不足（500）・トークン欠落や無効（401）の場合
 */
export const requireAuthenticatedUser = async (request: NextRequest): Promise<void> => {
  if (!serverAuthClient) {
    throw new AuthGuardError("Supabase Authの環境変数が不足しています。", 500);
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
};
