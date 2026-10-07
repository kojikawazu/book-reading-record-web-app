import { expect, test, type Page } from "@tests/support/e2e-test";

// SM-4: コンソールエラー収集用
const collectConsoleErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  return errors;
};

test("SM-1: ダッシュボードが表示される", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("dashboard-page")).toBeVisible();
});

test("SM-2: 統計ページが表示される", async ({ page }) => {
  await page.goto("/stats");
  await expect(page.getByTestId("stats-page")).toBeVisible();
});

test("SM-3: 書籍登録ページが表示される", async ({ page }) => {
  await page.goto("/books/new");
  await expect(page.getByTestId("book-title-input")).toBeVisible();
});

test("SM-4: 主要ページでコンソールエラーが出ない", async ({ page }) => {
  const errors = collectConsoleErrors(page);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.goto("/stats");
  await page.waitForLoadState("networkidle");

  // Next.js の hydration / fetch エラーのみ対象（外部リソース除外）
  const appErrors = errors.filter(
    (e) => !e.includes("favicon") && !e.includes("ERR_CONNECTION_REFUSED")
  );
  expect(appErrors).toHaveLength(0);
});

test("SM-5: 存在しない書籍 ID にアクセスしてもクラッシュしない", async ({ page }) => {
  await page.goto("/books/nonexistent-id-00000000");
  // トップへリダイレクトされるか、エラー UI が表示されるかのどちらか
  const isDashboard = await page
    .getByTestId("dashboard-page")
    .isVisible()
    .catch(() => false);
  const hasErrorUi = await page
    .getByText(/見つかりません|not found|エラー/i)
    .isVisible()
    .catch(() => false);
  expect(isDashboard || hasErrorUi).toBeTruthy();
});

test("SM-6: 全レスポンスにセキュリティヘッダーが付与される（#104）", async ({ request }) => {
  for (const path of ["/", "/stats", "/books/new", "/api/book-record/books"]) {
    const res = await request.get(path);
    const headers = res.headers();

    expect(headers["content-security-policy-report-only"], path).toContain("default-src 'self'");
    expect(headers["content-security-policy-report-only"], path).toContain(
      "frame-ancestors 'none'"
    );
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toBe("camera=(), microphone=(), geolocation=()");
  }
});
