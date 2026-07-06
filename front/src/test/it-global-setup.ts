import { spawnSync } from "node:child_process";

/**
 * IT 実行前に一度だけ走るグローバルセットアップ。
 * テストコンテナの Postgres へ `prisma db push` でスキーマを投入する。
 *
 * 破壊防止のため、DATABASE_URL がローカルの使い捨てコンテナ以外を指す場合は中断する
 * （共有 Supabase への push/migrate は禁止。`.claude/rules/database.md` の例外規定に対応）。
 */

// DATABASE_URL がテストコンテナ（localhost:5433）を指すことを厳格に検証する安全弁。
const assertDisposableTestDatabase = (rawUrl: string | undefined): void => {
  if (!rawUrl) {
    throw new Error("IT: DATABASE_URL が未設定です。.env.test を確認してください。");
  }

  const url = new URL(rawUrl);
  const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isTestPort = url.port === "5433";
  // 共有 Supabase を誤って壊さないための多重ガード。
  const looksRemote = /supabase\.(co|com)|amazonaws\.com/i.test(url.hostname);

  if (!isLocalHost || !isTestPort || looksRemote) {
    throw new Error(
      `IT: DATABASE_URL がテストコンテナ(localhost:5433)を指していません: ${url.hostname}:${url.port}. ` +
        "共有 DB への db push を防ぐため中断します。"
    );
  }
};

/**
 * Vitest グローバルセットアップのエントリポイント。
 *
 * @throws {Error} DATABASE_URL が使い捨てコンテナ以外を指す場合、または db push 失敗時
 */
export default function setup(): void {
  assertDisposableTestDatabase(process.env.DATABASE_URL);

  // テストコンテナへスキーマを materialize する。--skip-generate は Client 生成を分離済みのため。
  const result = spawnSync(
    "pnpm",
    ["exec", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      stdio: "inherit",
      env: process.env,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      "IT: prisma db push に失敗しました。テストコンテナが起動しているか確認してください。"
    );
  }
}
