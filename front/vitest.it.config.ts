import path from "node:path";
import { defineConfig } from "vitest/config";
// 設定ファイル自身のロード時点では resolve.alias がまだ効かないため、ここだけ相対 import にする
// （`.claude/rules/testing.md`「import はパスエイリアスを使う」の不可避な例外）。
import { applyTestDatabaseUrl } from "./tests/support/test-database-url";

/**
 * IT（結合）専用構成。UT（`vitest.config.ts`）とは分離する。
 * - Prisma はモックせず、`docker-compose.test.yml` の使い捨て Postgres に対して実行する。
 * - スキーマは `globalSetup` で `prisma db push`（テストコンテナ限定の例外運用）で投入する。
 * - DB 状態を共有するため直列実行（`fileParallelism: false` / 単一フォーク）にする。
 */

// 接続先の解決・検証・注入は tests/support/test-database-url.ts に集約する（`.claude/rules/testing.md`）。
// globalSetup と `prisma db push` の子プロセスも同じ接続先を見る必要があるため、main 側の
// process.env へも注入する。シェル由来の DATABASE_URL は検証済みの値で上書きされる。
const databaseUrl = applyTestDatabaseUrl(process.env, __dirname);

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/it/**/*.it.test.ts"],
    exclude: ["node_modules", "e2e/**"],
    globalSetup: ["tests/support/it-global-setup.ts"],
    // DB 状態を共有するため直列で回す（並行だと truncate と読み書きが競合する）。
    // Vitest 4 では poolOptions が廃止されトップレベル指定になった。
    fileParallelism: false,
    maxWorkers: 1,
    // 実 DB アクセス・スキーマ投入を待つため UT より長めに取る。
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // ワーカープロセスへ検証済みの接続先を伝搬する。
    env: { DATABASE_URL: databaseUrl },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
      "@scripts": path.resolve(__dirname, "./scripts"),
      // サーバー専用ガード（import "server-only"）はテスト実行環境では不要なため空スタブへ差し替える。
      "server-only": path.resolve(__dirname, "./tests/support/server-only-stub.ts"),
    },
  },
});
