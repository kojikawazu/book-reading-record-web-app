/**
 * バックログ B1〜B4 の E2E テスト
 *
 * 各機能が未実装のため全ケース test.skip でマーク。
 * 機能実装（Issue #9〜#12）完了後に test.skip → test に変更して有効化する。
 */
import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "book-reading-record.v1";

type SeedBook = {
  id: string;
  title: string;
  author: string;
  format: "paper" | "ebook" | "audio";
  totalPages: number;
  currentPage: number;
  tags: string[];
  status: "not_started" | "reading" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

type SeedPayload = {
  version: number;
  books: SeedBook[];
  progressLogs: { id: string; bookId: string; page: number; status: "not_started" | "reading" | "paused" | "completed"; loggedAt: string }[];
};

const isoDaysAgo = (days: number): string => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const seedStorage = async (page: Page, payload: SeedPayload) => {
  await page.addInitScript(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: payload }
  );
};

const createBookViaUi = async (args: {
  page: Page;
  title: string;
  author?: string;
  totalPages?: number;
  status?: "not_started" | "reading" | "paused";
}) => {
  const { page, title, author = "", totalPages, status = "reading" } = args;

  await page.goto("/");
  await page.getByTestId("add-book-link").click();

  await page.getByTestId("book-title-input").fill(title);
  if (author) {
    await page.getByTestId("book-author-input").fill(author);
  }
  if (totalPages !== undefined) {
    await page.getByTestId("book-total-pages-input").fill(String(totalPages));
  }
  await page.getByTestId("book-status-select").selectOption(status);
  await page.getByTestId("book-save-button").click();
  await expect(page).toHaveURL("/");
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const initializedKey = "__pw_storage_initialized__";
    if (!window.sessionStorage.getItem(initializedKey)) {
      window.localStorage.clear();
      window.sessionStorage.setItem(initializedKey, "1");
    }
  });
});

// ─── B1: 書籍削除（Issue #9）─────────────────────────────────────────────────

test.skip("B1-N1: 書籍を削除するとダッシュボードから消える", async ({ page }) => {
  await createBookViaUi({ page, title: "削除対象Book", author: "著者A", totalPages: 100 });
  await page.getByRole("link", { name: /削除対象Book/ }).click();
  await page.getByTestId("delete-book-button").click();
  await page.getByTestId("delete-confirm-button").click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("section-reading")).not.toContainText("削除対象Book");
});

test.skip("B1-N2: 削除後に関連進捗ログも消える", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-b1",
        title: "B1ログ付きBook",
        author: "著者",
        format: "paper",
        totalPages: 100,
        currentPage: 50,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(5),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [
      { id: "log-b1-1", bookId: "book-b1", page: 50, status: "reading", loggedAt: isoDaysAgo(1) },
    ],
  };
  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /B1ログ付きBook/ }).click();
  await page.getByTestId("delete-book-button").click();
  await page.getByTestId("delete-confirm-button").click();

  const stored = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as SeedPayload;
  }, STORAGE_KEY);
  const orphanLogs = stored.progressLogs?.filter((l) => l.bookId === "book-b1") ?? [];
  expect(orphanLogs).toHaveLength(0);
});

test.skip("B1-S1: 削除確認ダイアログでキャンセルすると削除されない", async ({ page }) => {
  await createBookViaUi({ page, title: "キャンセルBook", author: "著者B", totalPages: 100 });
  await page.getByRole("link", { name: /キャンセルBook/ }).click();
  await page.getByTestId("delete-book-button").click();
  await page.getByTestId("delete-cancel-button").click();
  await expect(page.getByRole("link", { name: /キャンセルBook/ })).toBeVisible();
});

// ─── B3: 著者任意入力（Issue #11）────────────────────────────────────────────

test.skip("B3-N1: 著者空でも書籍登録できる", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("add-book-link").click();
  await page.getByTestId("book-title-input").fill("著者なしBook");
  // 著者入力欄は空のまま
  await page.getByTestId("book-total-pages-input").fill("100");
  await page.getByTestId("book-status-select").selectOption("reading");
  await page.getByTestId("book-save-button").click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("section-reading")).toContainText("著者なしBook");
});

test.skip("B3-S1: 著者空の書籍詳細ページでレイアウト崩れがない", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("add-book-link").click();
  await page.getByTestId("book-title-input").fill("著者なし詳細Book");
  await page.getByTestId("book-total-pages-input").fill("100");
  await page.getByTestId("book-status-select").selectOption("reading");
  await page.getByTestId("book-save-button").click();
  await page.getByRole("link", { name: /著者なし詳細Book/ }).click();
  // 詳細ページが正常表示（クラッシュしない）
  await expect(page.getByText("著者なし詳細Book")).toBeVisible();
});

// ─── B4: 総ページ数未入力でも完読許可（Issue #12）────────────────────────────

test.skip("B4-N1: 総ページ数0の書籍でもステータス=完読で保存できる", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-b4",
        title: "ページなしBook",
        author: "著者",
        format: "paper",
        totalPages: 0,
        currentPage: 0,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(3),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [],
  };
  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /ページなしBook/ }).click();
  await page.getByTestId("progress-status-select").selectOption("completed");
  await page.getByTestId("progress-save-button").click();
  await expect(page.getByText("ステータス: 完読")).toBeVisible();
});

test.skip("B4-N2: 総ページ数0の完読後に感想入力セクションが表示される", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-b4-2",
        title: "ページなし完読Book",
        author: "著者",
        format: "paper",
        totalPages: 0,
        currentPage: 0,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(3),
        updatedAt: isoDaysAgo(1),
        completedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [],
  };
  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /ページなし完読Book/ }).click();
  await expect(page.getByTestId("reflection-learning-input")).toBeVisible();
});

test.skip("B4-N3: 総ページ数0の完読書籍で再読ボタンが動作する", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-b4-3",
        title: "ページなし再読Book",
        author: "著者",
        format: "paper",
        totalPages: 0,
        currentPage: 0,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(3),
        updatedAt: isoDaysAgo(1),
        completedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [],
  };
  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /ページなし再読Book/ }).click();
  await page.getByTestId("reread-button").click();
  await page.getByRole("link", { name: "ダッシュボードへ戻る" }).first().click();
  await expect(page.getByTestId("section-reading")).toContainText("ページなし再読Book");
});
