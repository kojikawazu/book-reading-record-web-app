import { expect, test as base } from "@playwright/test";

/** E2E 中に観測した CSP 違反 1 件。`securitypolicyviolation` イベントから必要な項目だけを写す。 */
type CspViolation = {
  /** 違反したディレクティブ（例: `script-src-elem`）。 */
  directive: string;
  /** ブロックされた読み込み先。インラインなら `inline`。 */
  blockedURI: string;
  /** 違反が起きたページの URL。 */
  documentURI: string;
};

/**
 * 全 E2E で使う `test`。各テストの終了時に、CSP 違反が 0 件であることを検証する。
 *
 * CSP は強制モード（#109）のため、違反は機能が壊れることを意味する。ブロックされた読み込みが
 * 画面上は無言で失敗するケースでも、このイベントで「主要フローで違反が出ない」ことを固定する。
 * `exposeFunction` はページ遷移をまたいで有効なので、テスト中の全ナビゲーションを拾う。
 */
export const test = base.extend<{ cspViolations: CspViolation[] }>({
  cspViolations: [
    async ({ page }, use) => {
      const violations: CspViolation[] = [];
      await page.exposeFunction("__reportCspViolation", (violation: CspViolation) => {
        violations.push(violation);
      });
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          // exposeFunction で注入した関数。型定義が無いため window を経由して呼ぶ。
          const report = (window as unknown as Record<string, (v: unknown) => void>)
            .__reportCspViolation;
          report?.({
            directive: event.effectiveDirective,
            blockedURI: event.blockedURI,
            documentURI: event.documentURI,
          });
        });
      });

      await use(violations);

      expect(violations, "CSP 違反が発生した（docs/06-security-specification.md）").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page } from "@playwright/test";
