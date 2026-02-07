"use client";

import { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { repositoryDriver } from "./repository-instance";
import { getSupabaseBrowserClient, isSupabaseAuthConfigured } from "./supabase/client";

type AuthSessionState = {
  authRequired: boolean;
  loading: boolean;
  session: Session | null;
  isAuthenticated: boolean;
  configError: string | null;
};

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
