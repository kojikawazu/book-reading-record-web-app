import { expect, test, type Page } from "@playwright/test";

const STORAGE_KEY = "book-reading-record.v1";

type SeedBook = {
  id: string;
  title: string;
  author: string;
  genre?: string;
  format: "paper" | "ebook" | "audio";
  totalPages: number;
  currentPage: number;
  tags: string[];
  status: "not_started" | "reading" | "paused" | "completed";
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  reflection?: {
    learning: string;
    action: string;
    quote: string;
    createdAt: string;
  };
};

type SeedLog = {
  id: string;
  bookId: string;
  page: number;
  memo?: string;
  status: "not_started" | "reading" | "paused" | "completed";
  loggedAt: string;
};

type SeedPayload = {
  version: number;
  books: SeedBook[];
  progressLogs: SeedLog[];
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
  author: string;
  totalPages: number;
  tags?: string;
  status?: "not_started" | "reading" | "paused";
}) => {
  const { page, title, author, totalPages, tags, status = "reading" } = args;

  await page.goto("/");
  await page.getByTestId("add-book-link").click();

  await page.getByTestId("book-title-input").fill(title);
  await page.getByTestId("book-author-input").fill(author);
  await page.getByTestId("book-total-pages-input").fill(String(totalPages));
  if (tags) {
    await page.getByTestId("book-tags-input").fill(tags);
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

test("Case 1: 初期表示", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  await expect(page.getByTestId("section-not-started")).toBeVisible();
  await expect(page.getByTestId("section-reading")).toBeVisible();
  await expect(page.getByTestId("section-paused")).toBeVisible();
  await expect(page.getByTestId("section-completed")).toBeVisible();
  await expect(page.getByTestId("add-book-link")).toBeVisible();
});

test("Case 2: 書籍登録", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "DDD実践ガイド",
    author: "Alice",
    totalPages: 320,
    status: "paused",
  });

  await expect(page.getByTestId("section-paused")).toContainText("DDD実践ガイド");
});

test("Case 3: 進捗記録（メモ付き）", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "TypeScript Deep Dive",
    author: "Bob",
    totalPages: 500,
    status: "reading",
  });

  await page.getByRole("link", { name: /TypeScript Deep Dive/ }).click();
  await page.getByTestId("progress-page-input").fill("120");
  await page.getByTestId("progress-memo-input").fill("Generics chapter done");
  await page.getByTestId("progress-save-button").click();

  await expect(page.getByTestId("save-message")).toContainText("保存しました");
  await expect(page.getByTestId("progress-logs")).toContainText("Generics chapter done");
  await expect(page.getByText("120 / 500")).toBeVisible();
});

test("Case 4: 完読登録（感想空入力可）", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Clean Code",
    author: "Uncle Bob",
    totalPages: 100,
    status: "reading",
  });

  await page.getByRole("link", { name: /Clean Code/ }).click();
  await page.getByTestId("progress-page-input").fill("100");
  await page.getByTestId("progress-save-button").click();

  await page.getByRole("link", { name: "ダッシュボードへ戻る" }).first().click();
  await expect(page.getByTestId("section-completed")).toContainText("Clean Code");
  await expect(page.getByTestId("section-pending-reflection")).toContainText("Clean Code");
});

test("Case 5: 再読", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-reread",
        title: "Refactoring",
        author: "Martin Fowler",
        format: "paper",
        totalPages: 250,
        currentPage: 250,
        tags: ["tech"],
        status: "completed",
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(2),
        completedAt: isoDaysAgo(2),
        reflection: {
          learning: "small steps",
          action: "practice",
          quote: "leave code cleaner",
          createdAt: isoDaysAgo(2),
        },
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /Refactoring/ }).click();
  await page.getByTestId("reread-button").click();

  await page.getByRole("link", { name: "ダッシュボードへ戻る" }).first().click();
  await expect(page.getByTestId("section-reading")).toContainText("Refactoring");
  await expect(page.getByTestId("section-completed")).not.toContainText("Refactoring");
});

test("Case 6: 検索", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "O'Reilly Rust",
    author: "Carol",
    totalPages: 420,
    tags: "systems, rust",
    status: "reading",
  });

  await createBookViaUi({
    page,
    title: "Mindset",
    author: "Dweck",
    totalPages: 210,
    tags: "selfhelp",
    status: "reading",
  });

  await page.getByTestId("search-input").fill("rust");
  await expect(page.getByTestId("section-reading")).toContainText("O'Reilly Rust");
  await expect(page.getByTestId("section-reading")).not.toContainText("Mindset");
});

test("Case 7: 週次可視化", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "b1",
        title: "Book A",
        author: "Author A",
        format: "paper",
        totalPages: 300,
        currentPage: 40,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(20),
        updatedAt: isoDaysAgo(1),
        reflection: {
          learning: "L",
          action: "A",
          quote: "Q",
          createdAt: isoDaysAgo(1),
        },
      },
      {
        id: "b2",
        title: "Book B",
        author: "Author B",
        format: "ebook",
        totalPages: 200,
        currentPage: 5,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(1),
        reflection: {
          learning: "old",
          action: "old",
          quote: "old",
          createdAt: isoDaysAgo(10),
        },
      },
    ],
    progressLogs: [
      { id: "l1", bookId: "b1", page: 10, memo: "", status: "reading", loggedAt: isoDaysAgo(2) },
      { id: "l2", bookId: "b1", page: 40, memo: "", status: "reading", loggedAt: isoDaysAgo(1) },
      { id: "l3", bookId: "b2", page: 5, memo: "", status: "reading", loggedAt: isoDaysAgo(1) },
      {
        id: "l4",
        bookId: "b2",
        page: 100,
        memo: "",
        status: "reading",
        loggedAt: isoDaysAgo(8),
      },
    ],
  };

  await seedStorage(page, payload);
  await page.goto("/");

  await expect(page.getByTestId("weekly-read-pages")).toHaveText("45");
  await expect(page.getByTestId("weekly-progress-count")).toHaveText("3");
  await expect(page.getByTestId("weekly-reflection-count")).toHaveText("1");
});

test("Case 8: 書籍登録バリデーション（総ページ数）", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("add-book-link").click();

  await page.getByTestId("book-title-input").fill("Bad Pages");
  await page.getByTestId("book-author-input").fill("Eve");
  await page.getByTestId("book-total-pages-input").fill("0");
  await page.getByTestId("book-save-button").click();

  await expect(page.getByTestId("error-total-pages")).toBeVisible();
});

test("Case 9: 進捗入力バリデーション（負数）", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Algorithms",
    author: "Sedgewick",
    totalPages: 350,
    status: "reading",
  });

  await page.getByRole("link", { name: /Algorithms/ }).click();
  await page.getByTestId("progress-page-input").fill("-1");
  await page.getByTestId("progress-save-button").click();

  await expect(page.getByTestId("error-page")).toBeVisible();
});

test("Case 10: 完読自動判定", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Design Patterns",
    author: "GoF",
    totalPages: 200,
    status: "reading",
  });

  await page.getByRole("link", { name: /Design Patterns/ }).click();
  await page.getByTestId("progress-page-input").fill("200");
  await page.getByTestId("progress-status-select").selectOption("reading");
  await page.getByTestId("progress-save-button").click();

  await expect(page.getByText("ステータス: 完読")).toBeVisible();
});

test("Case 11: localStorage 永続化", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Persistence Book",
    author: "Frank",
    totalPages: 150,
    status: "not_started",
  });

  const savedPayload = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw
      ? (JSON.parse(raw) as { version: number; books: unknown[]; progressLogs: unknown[] })
      : null;
  }, STORAGE_KEY);

  expect(savedPayload?.version).toBe(1);
  expect(Array.isArray(savedPayload?.books)).toBeTruthy();
  expect(Array.isArray(savedPayload?.progressLogs)).toBeTruthy();

  await page.reload();
  await expect(page.getByTestId("section-not-started")).toContainText("Persistence Book");
});

test("Case 12: 破損データ復旧", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(key, "{invalid-json");
  }, STORAGE_KEY);

  await page.goto("/");

  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  await expect(page.getByTestId("recovery-message")).toBeVisible();
  await expect(page.getByTestId("section-reading-empty")).toBeVisible();
});

test("Case 13: 再読データ整合性", async ({ page }) => {
  const originalReflection = {
    learning: "old-learning",
    action: "old-action",
    quote: "old-quote",
    createdAt: isoDaysAgo(1),
  };

  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book13",
        title: "Book13",
        author: "Author13",
        format: "paper",
        totalPages: 120,
        currentPage: 120,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(3),
        updatedAt: isoDaysAgo(1),
        completedAt: isoDaysAgo(1),
        reflection: originalReflection,
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /Book13/ }).click();
  await page.getByTestId("reread-button").click();

  const stored = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) || "{}");
  }, STORAGE_KEY);

  expect(stored.books[0].completedAt).toBeUndefined();
  expect(stored.books[0].reflection.learning).toBe("old-learning");
  expect(stored.books[0].reflection.action).toBe("old-action");
  expect(stored.books[0].reflection.quote).toBe("old-quote");
});

test("Case 14: 並び順（書籍一覧）", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "old",
        title: "Old Book",
        author: "A",
        format: "paper",
        totalPages: 100,
        currentPage: 10,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(10),
      },
      {
        id: "mid",
        title: "Mid Book",
        author: "B",
        format: "paper",
        totalPages: 100,
        currentPage: 20,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(9),
        updatedAt: isoDaysAgo(5),
      },
      {
        id: "new",
        title: "New Book",
        author: "C",
        format: "paper",
        totalPages: 100,
        currentPage: 30,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(8),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");

  const links = page.getByTestId("section-reading").locator("a");
  await expect(links.nth(0)).toContainText("New Book");
  await expect(links.nth(1)).toContainText("Mid Book");
  await expect(links.nth(2)).toContainText("Old Book");
});

test("Case 15: 並び順（進捗履歴）", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book15",
        title: "Book15",
        author: "Author15",
        format: "paper",
        totalPages: 200,
        currentPage: 80,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [
      { id: "l15-1", bookId: "book15", page: 30, status: "reading", loggedAt: isoDaysAgo(3) },
      { id: "l15-2", bookId: "book15", page: 80, status: "reading", loggedAt: isoDaysAgo(1) },
      { id: "l15-3", bookId: "book15", page: 50, status: "reading", loggedAt: isoDaysAgo(2) },
    ],
  };

  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /Book15/ }).click();

  const items = page.getByTestId("progress-logs").locator("li");
  await expect(items.nth(0)).toContainText("80ページ");
  await expect(items.nth(1)).toContainText("50ページ");
  await expect(items.nth(2)).toContainText("30ページ");
});

test("Case 16: 完読不正入力エラー", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Invalid Complete",
    author: "Grace",
    totalPages: 100,
    status: "reading",
  });

  await page.getByRole("link", { name: /Invalid Complete/ }).click();
  await page.getByTestId("progress-page-input").fill("70");
  await page.getByTestId("progress-status-select").selectOption("completed");
  await page.getByTestId("progress-save-button").click();

  await expect(page.getByTestId("error-status")).toBeVisible();
});

test("Case 17: 再完読時の感想再編集", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book17",
        title: "Book17",
        author: "Author17",
        format: "paper",
        totalPages: 100,
        currentPage: 100,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(20),
        updatedAt: isoDaysAgo(2),
        completedAt: isoDaysAgo(2),
        reflection: {
          learning: "old learning",
          action: "old action",
          quote: "old quote",
          createdAt: isoDaysAgo(2),
        },
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /Book17/ }).click();

  await page.getByTestId("reread-button").click();

  const afterReread = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) || "{}");
  }, STORAGE_KEY);
  expect(afterReread.books[0].reflection.learning).toBe("old learning");

  await page.getByTestId("progress-page-input").fill("100");
  await page.getByTestId("reflection-learning-input").fill("new learning");
  await page.getByTestId("reflection-action-input").fill("new action");
  await page.getByTestId("reflection-quote-input").fill("new quote");
  await page.getByTestId("progress-save-button").click();

  const afterRecomplete = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) || "{}");
  }, STORAGE_KEY);

  expect(afterRecomplete.books[0].reflection.learning).toBe("new learning");
  expect(afterRecomplete.books[0].reflection.action).toBe("new action");
  expect(afterRecomplete.books[0].reflection.quote).toBe("new quote");
});

test("Case 18: 統計レポート表示", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "stats-1",
        title: "Stats Book 1",
        author: "Author 1",
        format: "paper",
        totalPages: 100,
        currentPage: 100,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(20),
        updatedAt: isoDaysAgo(2),
      },
      {
        id: "stats-2",
        title: "Stats Book 2",
        author: "Author 2",
        format: "audio",
        totalPages: 250,
        currentPage: 80,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [
      {
        id: "stats-log-1",
        bookId: "stats-2",
        page: 20,
        status: "reading",
        loggedAt: isoDaysAgo(2),
      },
      {
        id: "stats-log-2",
        bookId: "stats-2",
        page: 80,
        status: "reading",
        loggedAt: isoDaysAgo(1),
      },
    ],
  };

  await seedStorage(page, payload);
  await page.goto("/stats");

  await expect(page.getByTestId("stats-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "統計レポート" })).toBeVisible();
  await expect(page.getByText("ステータス分布")).toBeVisible();
  await expect(page.getByText("読書形式の内訳")).toBeVisible();
  await expect(page.getByText("登録書籍数")).toBeVisible();
});
