import { spawnSync } from "node:child_process";

import { assertLocalTestDatabaseUrl } from "@tests/support/test-database-url";

/**
 * IT 実行前に一度だけ走るグローバルセットアップ。
 * テストコンテナの Postgres へ `prisma db push` でスキーマを投入する。
 *
 * 接続先は `vitest.it.config.ts` が解決・注入済みだが、**`db push` は破壊的操作のため
 * 直前に再検証する**（共有 Supabase への push/migrate は禁止。`.claude/rules/database.md`
 * の例外規定・`.claude/rules/testing.md`「テスト用 DB の接続先」に対応）。
 */

/**
 * Vitest グローバルセットアップのエントリポイント。
 *
 * @throws {Error} 接続先がローカルの使い捨てコンテナ以外を指す場合、または db push 失敗時
 */
export default function setup(): void {
  assertLocalTestDatabaseUrl(process.env.DATABASE_URL, "IT globalSetup");

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
