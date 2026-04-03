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

// ─── 追加ケース（手動確認削減） ───────────────────────────────────────────────

// --- Case 4b: 感想あり保存 → 感想未記入リストに出ない ---

test("Case 4b: 感想3項目を入力して保存すると感想未記入リストに出ない", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "感想あり本",
    author: "Author4b",
    totalPages: 100,
    status: "reading",
  });

  await page.getByRole("link", { name: /感想あり本/ }).click();
  await page.getByTestId("progress-page-input").fill("100");
  await page.getByTestId("reflection-learning-input").fill("学びの内容");
  await page.getByTestId("reflection-action-input").fill("行動の内容");
  await page.getByTestId("reflection-quote-input").fill("印象の一文");
  await page.getByTestId("progress-save-button").click();

  await page.getByRole("link", { name: "ダッシュボードへ戻る" }).first().click();
  await expect(page.getByTestId("section-completed")).toContainText("感想あり本");
  await expect(page.getByTestId("section-pending-reflection")).not.toContainText("感想あり本");
});

// --- Case 4c: 完読済み書籍の感想を後から上書き保存 ---

test("Case 4c: 完読済み書籍の感想を後から編集して上書き保存できる", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-4c",
        title: "Book4c",
        author: "Author4c",
        format: "paper",
        totalPages: 100,
        currentPage: 100,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(5),
        updatedAt: isoDaysAgo(1),
        completedAt: isoDaysAgo(1),
        reflection: {
          learning: "old learning",
          action: "old action",
          quote: "old quote",
          createdAt: isoDaysAgo(1),
        },
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByRole("link", { name: /Book4c/ }).click();

  await page.getByTestId("reflection-learning-input").fill("new learning");
  await page.getByTestId("reflection-action-input").fill("new action");
  await page.getByTestId("reflection-quote-input").fill("new quote");
  await page.getByTestId("progress-save-button").click();

  const stored = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as SeedPayload;
  }, STORAGE_KEY);
  expect(stored.books[0].reflection?.learning).toBe("new learning");
  expect(stored.books[0].reflection?.action).toBe("new action");
  expect(stored.books[0].reflection?.quote).toBe("new quote");
});

// --- Case 5b: reflection なし完読書籍の再読 ---

test("Case 5b: reflection なし完読書籍を再読できる", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-5b",
        title: "Book5b",
        author: "Author5b",
        format: "paper",
        totalPages: 100,
        currentPage: 100,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(5),
        updatedAt: isoDaysAgo(1),
        completedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");
  // reflection なし完読書籍は section-completed と section-pending-reflection の両方に出るため
  // section-completed 内のリンクを明示的に指定する
  await page.getByTestId("section-completed").getByRole("link", { name: /Book5b/ }).click();
  await page.getByTestId("reread-button").click();

  await page.getByRole("link", { name: "ダッシュボードへ戻る" }).first().click();
  await expect(page.getByTestId("section-reading")).toContainText("Book5b");
  await expect(page.getByTestId("section-completed")).not.toContainText("Book5b");
});

// --- Case 5c: 再読後 currentPage が 0 になる ---

test("Case 5c: 再読後に currentPage が 0 にリセットされる", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-5c",
        title: "Book5c",
        author: "Author5c",
        format: "paper",
        totalPages: 200,
        currentPage: 200,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(5),
        updatedAt: isoDaysAgo(1),
        completedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");
  await page.getByTestId("section-completed").getByRole("link", { name: /Book5c/ }).click();
  await page.getByTestId("reread-button").click();

  const stored = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key) || "{}") as SeedPayload;
  }, STORAGE_KEY);
  expect(stored.books[0].currentPage).toBe(0);
  expect(stored.books[0].completedAt).toBeUndefined();
});

// --- Case 6b: 著者名で検索 ---

test("Case 6b: 著者名で検索すると一致する書籍のみ表示される", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "TypeScript Book",
    author: "UniqueAuthorXYZ",
    totalPages: 200,
    status: "reading",
  });
  await createBookViaUi({
    page,
    title: "Other Book",
    author: "SomeoneElse",
    totalPages: 150,
    status: "reading",
  });

  await page.getByTestId("search-input").fill("UniqueAuthorXYZ");
  await expect(page.getByTestId("section-reading")).toContainText("TypeScript Book");
  await expect(page.getByTestId("section-reading")).not.toContainText("Other Book");
});

// --- Case 6c: タグで検索 ---

test("Case 6c: タグで検索すると一致する書籍のみ表示される", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Tagged Book",
    author: "AuthorTag",
    totalPages: 100,
    tags: "golang, backend",
    status: "reading",
  });
  await createBookViaUi({
    page,
    title: "Untagged Book",
    author: "AuthorNoTag",
    totalPages: 100,
    status: "reading",
  });

  await page.getByTestId("search-input").fill("golang");
  await expect(page.getByTestId("section-reading")).toContainText("Tagged Book");
  await expect(page.getByTestId("section-reading")).not.toContainText("Untagged Book");
});

// --- Case 6d: 検索後に空文字でクリアすると全書籍が再表示 ---

test("Case 6d: 検索後に空文字を入力すると全書籍が再表示される", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Book Alpha",
    author: "Alice",
    totalPages: 100,
    status: "reading",
  });
  await createBookViaUi({
    page,
    title: "Book Beta",
    author: "Bob",
    totalPages: 100,
    status: "reading",
  });

  await page.getByTestId("search-input").fill("Alpha");
  await expect(page.getByTestId("section-reading")).not.toContainText("Book Beta");

  await page.getByTestId("search-input").fill("");
  await expect(page.getByTestId("section-reading")).toContainText("Book Alpha");
  await expect(page.getByTestId("section-reading")).toContainText("Book Beta");
});

// --- Case 6e: 一致なしで全セクションが空 ---

test("Case 6e: 一致しないクエリで書籍が表示されない", async ({ page }) => {
  await createBookViaUi({
    page,
    title: "Visible Book",
    author: "Author",
    totalPages: 100,
    status: "reading",
  });

  await page.getByTestId("search-input").fill("zzznomatch99999");
  await expect(page.getByTestId("section-reading")).not.toContainText("Visible Book");
});

// --- Case 7b: 週次ゼロ状態 ---

test("Case 7b: 進捗ログなし書籍のみの場合は週次集計がすべてゼロ", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "b7b",
        title: "Zero Book",
        author: "Author",
        format: "paper",
        totalPages: 300,
        currentPage: 0,
        tags: [],
        status: "not_started",
        createdAt: isoDaysAgo(5),
        updatedAt: isoDaysAgo(5),
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/");

  await expect(page.getByTestId("weekly-read-pages")).toHaveText("0");
  await expect(page.getByTestId("weekly-progress-count")).toHaveText("0");
  await expect(page.getByTestId("weekly-reflection-count")).toHaveText("0");
});

// --- Case 7c: 7日境界ぴったりのログは集計に含まれる ---

test("Case 7c: 7日境界ぴったり（start 00:00）のログは集計に含まれる", async ({ page }) => {
  // helpers.ts の start = 当日 00:00 - 6日 に合わせてローカルタイムで境界を生成する
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const boundaryIso = start.toISOString();

  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "b7c",
        title: "Boundary Book",
        author: "Author",
        format: "paper",
        totalPages: 300,
        currentPage: 50,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [
      { id: "l7c-1", bookId: "b7c", page: 50, memo: "", status: "reading", loggedAt: boundaryIso },
    ],
  };

  await seedStorage(page, payload);
  await page.goto("/");

  await expect(page.getByTestId("weekly-progress-count")).toHaveText("1");
  await expect(page.getByTestId("weekly-read-pages")).toHaveText("50");
});

// --- Case 7d: 8日前のログは集計外 ---

test("Case 7d: 8日前のログは集計外になる", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "b7d",
        title: "Old Log Book",
        author: "Author",
        format: "paper",
        totalPages: 300,
        currentPage: 80,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(15),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [
      { id: "l7d-old", bookId: "b7d", page: 50, memo: "", status: "reading", loggedAt: isoDaysAgo(8) },
      { id: "l7d-new", bookId: "b7d", page: 80, memo: "", status: "reading", loggedAt: isoDaysAgo(1) },
    ],
  };

  await seedStorage(page, payload);
  await page.goto("/");

  // 8日前ログ(page=50)は集計外、1日前ログ(page=80, 起点0からの差分=80)のみ
  await expect(page.getByTestId("weekly-progress-count")).toHaveText("1");
  await expect(page.getByTestId("weekly-read-pages")).toHaveText("80");
});

// --- Case 12b: バージョン不一致ペイロードで復旧 ---

test("Case 12b: バージョン不一致ペイロードは破損扱いで復旧する", async ({ page }) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: 999, books: [], progressLogs: [] })
    );
  }, STORAGE_KEY);

  await page.goto("/");

  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  await expect(page.getByTestId("recovery-message")).toBeVisible();
});

// --- Case 12c: books フィールドが配列でないペイロードで復旧 ---

test("Case 12c: books フィールドが配列でないペイロードは破損扱いで復旧する", async ({
  page,
}) => {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ version: 1, books: "invalid", progressLogs: [] })
    );
  }, STORAGE_KEY);

  await page.goto("/");

  await expect(page.getByTestId("dashboard-page")).toBeVisible();
  await expect(page.getByTestId("recovery-message")).toBeVisible();
});

// --- Case 18b: stats ページの登録書籍数・完読率の実数値検証 ---

test("Case 18b: stats ページに登録書籍数と完読率が正しく表示される", async ({ page }) => {
  // 完読2冊 + 読書中1冊 = 計3冊、完読率 = Math.round(2/3 * 1000) / 10 = 66.7%
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "s18b-1",
        title: "完読本1",
        author: "A",
        format: "paper",
        totalPages: 100,
        currentPage: 100,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(10),
        updatedAt: isoDaysAgo(3),
        completedAt: isoDaysAgo(3),
      },
      {
        id: "s18b-2",
        title: "完読本2",
        author: "B",
        format: "ebook",
        totalPages: 200,
        currentPage: 200,
        tags: [],
        status: "completed",
        createdAt: isoDaysAgo(8),
        updatedAt: isoDaysAgo(2),
        completedAt: isoDaysAgo(2),
      },
      {
        id: "s18b-3",
        title: "読書中本",
        author: "C",
        format: "audio",
        totalPages: 150,
        currentPage: 60,
        tags: [],
        status: "reading",
        createdAt: isoDaysAgo(5),
        updatedAt: isoDaysAgo(1),
      },
    ],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/stats");

  await expect(page.getByTestId("stats-page")).toBeVisible();
  // 登録書籍数 KPI（data-testid なし → テキスト検索）
  await expect(page.getByText("3").first()).toBeVisible();
  // 完読率 KPI = 66.7%
  await expect(page.getByText("66.7%")).toBeVisible();
});

// --- Case 18c: 書籍ゼロ状態でも stats ページがクラッシュしない ---

test("Case 18c: 書籍ゼロ状態でも stats ページがクラッシュしない", async ({ page }) => {
  const payload: SeedPayload = {
    version: 1,
    books: [],
    progressLogs: [],
  };

  await seedStorage(page, payload);
  await page.goto("/stats");

  await expect(page.getByTestId("stats-page")).toBeVisible();
  // 完読率 KPI の 0% を特定（stats-kpi-completed article 内の数値）
  await expect(page.locator("article.stats-kpi-completed").getByText("0%")).toBeVisible();
});
