import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// docker-compose.test.yml の使い捨てコンテナに対応する既定接続先。
// .env.test を置かなくても IT が回るよう、コミット不要な安全なローカル値をフォールバックにする。
const DEFAULT_IT_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/book_record_test?schema=public",
  DIRECT_URL: "postgresql://postgres:postgres@localhost:5433/book_record_test?schema=public",
};

/**
 * IT（結合）専用構成。UT（`vitest.config.ts`）とは分離する。
 * - Prisma はモックせず、`docker-compose.test.yml` の使い捨て Postgres に対して実行する。
 * - スキーマは `globalSetup` で `prisma db push`（テストコンテナ限定の例外運用）で投入する。
 * - DB 状態を共有するため直列実行（`fileParallelism: false` / 単一フォーク）にする。
 */

// .env.test を最小パースして process.env へ流し込む。
// prisma-client.ts は import 時に DATABASE_URL を読むため、ワーカーにも env を渡す必要がある。
const loadTestEnv = (): Record<string, string> => {
  const file = path.resolve(__dirname, ".env.test");
  // .env.test はローカル上書き用（gitignore）。無ければコンテナ既定値で動かす。
  if (!existsSync(file)) {
    return { ...DEFAULT_IT_ENV };
  }
  const env: Record<string, string> = { ...DEFAULT_IT_ENV };
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
};

const testEnv = loadTestEnv();
// globalSetup と `prisma db push` の子プロセスも同じ DATABASE_URL を見る必要があるため main 側にも反映する。
Object.assign(process.env, testEnv);

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.it.test.ts"],
    exclude: ["node_modules", "e2e/**"],
    globalSetup: ["src/test/it-global-setup.ts"],
    // DB 状態を共有するため直列で回す（並行だと truncate と読み書きが競合する）。
    // Vitest 4 では poolOptions が廃止されトップレベル指定になった。
    fileParallelism: false,
    maxWorkers: 1,
    // 実 DB アクセス・スキーマ投入を待つため UT より長めに取る。
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // ワーカープロセスへ DATABASE_URL 等を伝搬する。
    env: testEnv,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // サーバー専用ガード（import "server-only"）はテスト実行環境では不要なため空スタブへ差し替える。
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
