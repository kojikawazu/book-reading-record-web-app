"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let browserClient: SupabaseClient | null = null;

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseKey);

export const getSupabaseBrowserClient = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase Authの環境変数が不足しています。");
  }

  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
};
