import { spawnSync } from "node:child_process";
import path from "node:path";

import { assertLocalTestDatabaseUrl } from "@tests/support/test-database-url";

/**
 * IT 実行前に一度だけ走るグローバルセットアップ。
 *
 * 1. テストコンテナの Postgres へ `prisma db push` でスキーマを投入する
 * 2. RLS 検証用の足場（auth スキーマ・auth.uid()・非オーナーロール）を作る
 * 3. 本番の写しである RLS ポリシーを適用する
 *
 * 接続先は `vitest.it.config.ts` が解決・注入済みだが、**いずれも破壊的操作のため
 * 直前に再検証する**（共有 Supabase への push/migrate は禁止。`.claude/rules/database.md`
 * の例外規定・`.claude/rules/testing.md`「テスト用 DB の接続先」に対応）。
 */

/** リポジトリ直下から見た `front/` の絶対パス。SQL ファイルの解決に使う。 */
const FRONT_DIR = path.resolve(__dirname, "../..");

/**
 * `pnpm exec prisma ...` を実行し、失敗したら理由付きで throw する。
 *
 * @param args - prisma へ渡す引数列
 * @param failureMessage - 失敗時に投げるメッセージ
 * @throws {Error} 終了コードが 0 以外の場合
 */
const runPrisma = (args: string[], failureMessage: string): void => {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    stdio: "inherit",
    cwd: FRONT_DIR,
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(failureMessage);
  }
};

/**
 * Vitest グローバルセットアップのエントリポイント。
 *
 * @throws {Error} 接続先がローカルの使い捨てコンテナ以外を指す場合、または投入に失敗した場合
 */
export default function setup(): void {
  assertLocalTestDatabaseUrl(process.env.DATABASE_URL, "IT globalSetup");

  // テストコンテナへスキーマを materialize する。--skip-generate は Client 生成を分離済みのため。
  runPrisma(
    ["db", "push", "--skip-generate", "--accept-data-loss"],
    "IT: prisma db push に失敗しました。テストコンテナが起動しているか確認してください。"
  );

  // 足場 → ポリシーの順に適用する。ポリシーの式が auth.uid() を参照するため順序が必要。
  // grant は db push でテーブルが作られた後でなければ対象が無い。
  runPrisma(
    [
      "db",
      "execute",
      "--file",
      "tests/support/rls-test-setup.sql",
      "--schema",
      "prisma/schema.prisma",
    ],
    "IT: RLS 検証用の足場（auth.uid()・ロール）の作成に失敗しました。"
  );

  runPrisma(
    ["db", "execute", "--file", "prisma/rls-policies.sql", "--schema", "prisma/schema.prisma"],
    "IT: RLS ポリシーの適用に失敗しました。"
  );
}
