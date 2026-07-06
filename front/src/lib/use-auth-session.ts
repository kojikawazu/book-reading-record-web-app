"use client";

import { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { repositoryDriver } from "./repository-instance";
import { getSupabaseBrowserClient, isSupabaseAuthConfigured } from "./supabase/client";

/** useAuthSession が返す認証状態。 */
type AuthSessionState = {
  /** `supabase` モードで認証が必要かどうか。 */
  authRequired: boolean;
  /** セッション確認中かどうか（`local` モードや設定不足時は常に false）。 */
  loading: boolean;
  session: Session | null;
  isAuthenticated: boolean;
  /** Supabase Auth の環境変数不足など、設定起因のエラー文言。 */
  configError: string | null;
};

/**
 * Supabase セッションを購読し、画面の認証ガードに必要な状態を返すフック。
 * `local` モード（認証不要）や環境変数不足時は購読せず、非ログイン扱いの安全な既定値を返す。
 *
 * @returns 認証要否・ローディング・セッション・ログイン有無・設定エラーをまとめた状態
 */
export const useAuthSession = (): AuthSessionState => {
  const authRequired = repositoryDriver === "supabase";
  const authConfigured = isSupabaseAuthConfigured;
  const configError =
    authRequired && !authConfigured ? "Supabase Authの環境変数が不足しています。" : null;
  const [loading, setLoading] = useState(authRequired && authConfigured);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!authRequired || !authConfigured) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      if (error) {
        setSession(null);
      } else {
        setSession(data.session ?? null);
      }

      setLoading(false);
    };

    void bootstrap();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authConfigured, authRequired]);

  const isAuthenticated = useMemo(() => {
    return Boolean(session?.access_token);
  }, [session]);

  return {
    authRequired,
    loading: authRequired && authConfigured ? loading : false,
    session: authRequired && authConfigured ? session : null,
    isAuthenticated,
    configError,
  };
};
