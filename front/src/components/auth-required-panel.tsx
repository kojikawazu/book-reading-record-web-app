import Link from "next/link";

type AuthRequiredPanelProps = {
  /** ログイン後に戻す遷移先パス（`?next=` に埋め込む）。 */
  nextPath: string;
  /** 設定起因のエラー文言。あれば警告として併記する。 */
  configError?: string | null;
};

/**
 * 更新系操作が認証必須のときに表示する、ログイン導線付きパネル。
 * `nextPath` を保持したログインリンクを提示する。
 */
export const AuthRequiredPanel = ({ nextPath, configError }: AuthRequiredPanelProps) => {
  const loginHref = `/auth/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <section className="panel-soft mx-auto max-w-xl space-y-3 p-6">
      <h2 className="text-xl font-bold text-[color:var(--foreground)]">ログインが必要です</h2>
      <p className="text-sm text-[color:var(--foreground)]/70">
        Googleアカウントでログインしてから再度お試しください。
      </p>
      {configError && <p className="notice-danger p-3 text-sm">{configError}</p>}
      <Link href={loginHref} className="btn-primary inline-flex px-4 py-2 text-sm">
        Googleでログイン
      </Link>
    </section>
  );
};
