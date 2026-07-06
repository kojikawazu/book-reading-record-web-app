"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// クライアントは初回生成後に使い回す（毎回 createClient するとセッション購読が多重化するため）。
let browserClient: SupabaseClient | null = null;

/** Supabase Auth に必要な URL/キーが揃っているか。未設定なら認証機能を無効化する。 */
export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * ブラウザ用 Supabase クライアントを遅延生成して返す（シングルトン）。
 *
 * @returns Supabase クライアント
 * @throws {Error} URL/キーが未設定の場合
 */
export const getSupabaseBrowserClient = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase Authの環境変数が不足しています。");
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
};
