"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseAuthConfigured } from "@/lib/supabase/client";
import { repositoryDriver } from "@/lib/repository-instance";

const sanitizeNextPath = (value: string | null): string => {
  if (!value || !value.startsWith("/")) {
    return "/";
  }

  return value;
};

const LoginContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const authRequired = repositoryDriver === "supabase";
  const nextPath = useMemo(() => sanitizeNextPath(searchParams.get("next")), [searchParams]);

  useEffect(() => {
    if (!authRequired || !isSupabaseAuthConfigured) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) {
        return;
      }

      if (data.session) {
        router.replace(nextPath);
      }
    };

    void sync();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      if (session) {
        router.replace(nextPath);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authRequired, nextPath, router]);

  const handleGoogleLogin = async () => {
    if (!authRequired) {
      router.replace(nextPath);
      return;
    }

    if (!isSupabaseAuthConfigured) {
      setErrorMessage("Supabase Authの環境変数が不足しています。");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/login?next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Googleログインに失敗しました。";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel-card mx-auto w-full max-w-md space-y-5 p-8 text-center">
      <h1 className="text-2xl font-bold text-[color:var(--foreground)]">ログイン</h1>
      <p className="text-sm text-[color:var(--foreground)]/72">
        読書記録データの利用にはGoogleログインが必要です。
      </p>

      {errorMessage && <p className="notice-danger p-3 text-sm">{errorMessage}</p>}

      <button
        type="button"
        disabled={loading}
        onClick={handleGoogleLogin}
        className="btn-primary inline-flex w-full justify-center px-4 py-2.5 text-sm disabled:opacity-60"
      >
        {loading ? "ログイン中..." : "Googleでログイン"}
      </button>

      <Link href="/" className="btn-secondary inline-flex w-full justify-center px-4 py-2 text-sm">
        ダッシュボードへ戻る
      </Link>
    </section>
  );
};

const LoginFallback = () => {
  return (
    <section className="panel-card mx-auto w-full max-w-md space-y-4 p-8 text-center">
      <h1 className="text-2xl font-bold text-[color:var(--foreground)]">ログイン</h1>
      <p className="text-sm text-[color:var(--foreground)]/72">読み込み中です...</p>
    </section>
  );
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full items-center justify-center px-4">
      <Suspense fallback={<LoginFallback />}>
        <LoginContent />
      </Suspense>
    </main>
  );
}
