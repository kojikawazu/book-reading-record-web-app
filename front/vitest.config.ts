import path from "path";
import { defineConfig } from "vitest/config";

// UT（単体）専用構成。外部 I/O をモックし DB・ネットワーク非依存で実行する。
// IT（*.it.test.ts）は DB 依存のため別構成（vitest.it.config.ts）で分離する。
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "e2e/**", "src/**/*.it.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // サーバー専用ガード（import "server-only"）は UT 実行環境では不要なため空スタブへ差し替える。
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
});
