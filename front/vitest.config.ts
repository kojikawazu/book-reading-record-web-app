import path from "path";
import { defineConfig } from "vitest/config";

// UT（単体）専用構成。外部 I/O をモックし DB・ネットワーク非依存で実行する。
// IT（tests/it/）は DB 依存のため別構成（vitest.it.config.ts）で分離する。
// テストは tests/ に集約する（配置規約は .claude/rules/testing.md）。
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/ut/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "e2e/**", "tests/it/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
      // サーバー専用ガード（import "server-only"）は UT 実行環境では不要なため空スタブへ差し替える。
      "server-only": path.resolve(__dirname, "./tests/support/server-only-stub.ts"),
    },
  },
});
