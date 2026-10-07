/**
 * バックログ B1〜B4 の E2E テスト
 *
 * 未実装の機能は test.skip でマークし、実装完了時に test へ変更して有効化する。
 * 現時点で skip は無い（B2 は Issue #10 実装時に追加する）。
 *
 * カバレッジ:
 *   B1: 書籍削除（Issue #9）  → B1-N1, B1-N2, B1-N3, B1-S1, B1-S2（**実装済み・有効**）
 *   B2: 書籍イメージ（Issue #10）→ UI・外部URL表示が絡むため、Issue #10 実装時に別途追加する
 *   B3: 著者名任意入力（Issue #11）→ B3-N1, B3-S1, B3-S2（**実装済み・有効**）
 *   B4: 総ページ数なし完読（Issue #12）→ B4-N1, B4-N2, B4-N3（**実装済み・有効**）
 */
import { expect, test, type Page } from "@tests/support/e2e-test";

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
  progressLogs: {
    id: string;
    bookId: string;
    page: number;
    status: "not_started" | "reading" | "paused" | "completed";
    loggedAt: string;
  }[];
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

test("B1-N1: 書籍を削除するとダッシュボードから消える", async ({ page }) => {
  await createBookViaUi({ page, title: "削除対象Book", author: "著者A", totalPages: 100 });
  await page.getByRole("link", { name: /削除対象Book/ }).click();

  await page.getByTestId("delete-book-button").click();
  await page.getByTestId("delete-confirm-button").click();

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("section-reading")).not.toContainText("削除対象Book");
});

test("B1-N2: 削除後に関連進捗ログも消える", async ({ page }) => {
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

test("B1-S1: 削除確認ダイアログでキャンセルすると削除されない", async ({ page }) => {
  await createBookViaUi({ page, title: "キャンセルBook", author: "著者B", totalPages: 100 });
  await page.getByRole("link", { name: /キャンセルBook/ }).click();

  await page.getByTestId("delete-book-button").click();
  await expect(page.getByTestId("delete-confirm-dialog")).toBeVisible();

  await page.getByTestId("delete-cancel-button").click();

  // 確認パネルが閉じ、詳細ページに留まる（遷移しない）。
  await expect(page.getByTestId("delete-confirm-dialog")).toBeHidden();
  await expect(page.getByTestId("book-title")).toHaveText("キャンセルBook");

  // 期待結果の正は「一覧に書籍が残る」（docs/08 B1-S1）。詳細ページの表示だけでは
  // 削除されていないことの証明にならないため、ダッシュボードまで戻って確認する。
  await page.getByRole("link", { name: "ダッシュボードへ戻る" }).first().click();
  await expect(page.getByTestId("section-reading")).toContainText("キャンセルBook");
});

test("B1-S2: 削除確認を出さずにページを離れても削除されない", async ({ page }) => {
  await createBookViaUi({ page, title: "未確定Book", author: "著者C", totalPages: 100 });
  await page.getByRole("link", { name: /未確定Book/ }).click();

  // 削除ボタンは確認パネルを開くだけで、それ自体は削除を実行しない。
  await page.getByTestId("delete-book-button").click();
  await page.goto("/");

  await expect(page.getByTestId("section-reading")).toContainText("未確定Book");
});

test("B1-N3: 詳細の操作ボタンは書籍情報カードの直上（カードの外）にあり、ヘッダーには置かない（#116）", async ({
  page,
}) => {
  // 再読開始は完読時にしか出ないため、完読済みの書籍で 3 つのボタンを揃えて検証する。
  const payload: SeedPayload = {
    version: 1,
    books: [
      {
        id: "book-b1-n3",
        title: "配置確認Book",
        author: "著者",
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
  await page.goto("/books/book-b1-n3");

  const actions = page.getByTestId("book-actions");
  await expect(actions.getByRole("link", { name: "ダッシュボードへ戻る" })).toBeVisible();
  await expect(actions.getByTestId("reread-button")).toBeVisible();
  await expect(actions.getByTestId("delete-book-button")).toBeVisible();

  // ヘッダー（共通シェルの banner）にも、書籍情報カードの中にも置かれていない。
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "ダッシュボードへ戻る" })).toHaveCount(0);
  await expect(header.getByTestId("delete-book-button")).toHaveCount(0);
  const card = page.getByTestId("book-info-card");
  await expect(card.getByTestId("delete-book-button")).toHaveCount(0);

  // 操作行がカードより上にある。
  const actionsBox = await actions.boundingBox();
  const cardBox = await card.boundingBox();
  if (!actionsBox || !cardBox) {
    throw new Error("操作行または書籍情報カードが描画されていない");
  }
  expect(actionsBox.y + actionsBox.height).toBeLessThanOrEqual(cardBox.y);
});

// ─── B3: 著者任意入力（Issue #11）────────────────────────────────────────────

test("B3-N1: 著者空でも書籍登録できる", async ({ page }) => {
  // 著者入力欄は空のまま（createBookViaUi の author 既定値が "" のため入力しない）
  await createBookViaUi({ page, title: "著者なしBook", totalPages: 100 });

  const section = page.getByTestId("section-reading");
  await expect(section).toContainText("著者なしBook");
  // 著者欄は空にせず代替ラベルを出す（欄が消えるとカードの高さが揃わない）。
  await expect(section).toContainText("著者不明");
});

test("B3-S1: 著者空の書籍詳細ページでレイアウト崩れがない", async ({ page }) => {
  await createBookViaUi({ page, title: "著者なし詳細Book", totalPages: 100 });
  await page.getByRole("link", { name: /著者なし詳細Book/ }).click();

  // 詳細ページが正常表示（クラッシュしない）
  await expect(page.getByTestId("book-title")).toHaveText("著者なし詳細Book");
  await expect(page.getByText("著者不明")).toBeVisible();
});

test("B3-S2: 著者ありの書籍は代替ラベルを出さない（既存データの回帰確認）", async ({ page }) => {
  await createBookViaUi({ page, title: "著者ありBook", author: "Boswell", totalPages: 100 });

  const section = page.getByTestId("section-reading");
  await expect(section).toContainText("Boswell");
  await expect(section).not.toContainText("著者不明");
});

// ─── B4: 総ページ数未入力でも完読許可（Issue #12）────────────────────────────

test("B4-N1: 総ページ数0の書籍でもステータス=完読で保存できる", async ({ page }) => {
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

test("B4-N4: 総ページ数を空欄のまま書籍登録できる", async ({ page }) => {
  await createBookViaUi({ page, title: "空欄ページBook", author: "著者" });

  await expect(page.getByTestId("section-reading")).toContainText("空欄ページBook");
  // 分母が無いため進捗率は表示せず、到達ページのみを示す（docs/03 第2部 6）。
  await expect(page.getByTestId("section-reading")).toContainText("0 ページ");
});

test("B4-N2: 総ページ数0の完読後に感想入力セクションが表示される", async ({ page }) => {
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
  // 完読済みかつ感想未記入の書籍は「完読」と「感想未記入」の両セクションに表示される
  // （docs/03 第1部 ダッシュボード）。どちらから辿っても同じ詳細ページへ遷移する。
  await page
    .getByRole("link", { name: /ページなし完読Book/ })
    .first()
    .click();
  await expect(page.getByTestId("reflection-learning-input")).toBeVisible();
});

test("B4-N3: 総ページ数0の完読書籍で再読ボタンが動作する", async ({ page }) => {
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
  // 完読済みかつ感想未記入の書籍は「完読」と「感想未記入」の両セクションに表示される
  // （docs/03 第1部 ダッシュボード）。どちらから辿っても同じ詳細ページへ遷移する。
  await page
    .getByRole("link", { name: /ページなし再読Book/ })
    .first()
    .click();
  await page.getByTestId("reread-button").click();
  await page.getByRole("link", { name: "ダッシュボードへ戻る" }).first().click();
  await expect(page.getByTestId("section-reading")).toContainText("ページなし再読Book");
});
