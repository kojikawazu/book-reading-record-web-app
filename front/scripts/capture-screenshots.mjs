// Seeds localStorage with sample data and captures screenshots of the main pages.
//
// Usage:
//   1. Start the dev server in local mode:
//        NEXT_PUBLIC_REPOSITORY_DRIVER=local pnpm dev
//   2. In another terminal:
//        pnpm screenshots
//
// Output: docs/assets/{dashboard,stats,book-detail}.png
//
// Requires Playwright's Chromium (installed via `pnpm test:e2e:install`).
// Set PLAYWRIGHT_BROWSERS_PATH=.playwright so the local browser is found.

import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../../docs/assets");
const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";

const iso = (daysAgo, hour = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const BOOK1 = "11111111-1111-1111-1111-111111111111"; // 読書中（詳細用）
const BOOK2 = "22222222-2222-2222-2222-222222222222"; // 完読＋感想
const BOOK3 = "33333333-3333-3333-3333-333333333333"; // 読書前
const BOOK4 = "44444444-4444-4444-4444-444444444444"; // 保留

const seed = {
  version: 1,
  books: [
    {
      id: BOOK1,
      title: "アトミック・ハビッツ",
      author: "James Clear",
      genre: "自己啓発",
      format: "ebook",
      totalPages: 320,
      currentPage: 140,
      tags: ["習慣", "自己啓発"],
      status: "reading",
      createdAt: iso(20),
      updatedAt: iso(1),
    },
    {
      id: BOOK2,
      title: "マインドセット「やればできる！」の研究",
      author: "Carol S. Dweck",
      genre: "心理学",
      format: "paper",
      totalPages: 360,
      currentPage: 360,
      tags: ["心理学", "成長"],
      status: "completed",
      createdAt: iso(30),
      updatedAt: iso(3),
      completedAt: iso(3),
      reflection: {
        learning: "能力は固定ではなく、努力と学習で伸ばせるという視点が腹落ちした。",
        action: "失敗を『まだできていないだけ』と捉え直して挑戦回数を増やす。",
        quote: "「まだ」できない、だけだ。",
        createdAt: iso(3),
      },
    },
    {
      id: BOOK3,
      title: "リーダブルコード",
      author: "Dustin Boswell",
      genre: "技術",
      format: "paper",
      totalPages: 260,
      currentPage: 0,
      tags: ["プログラミング"],
      status: "not_started",
      createdAt: iso(5),
      updatedAt: iso(5),
    },
    {
      id: BOOK4,
      title: "達人プログラマー",
      author: "David Thomas",
      genre: "技術",
      format: "ebook",
      totalPages: 400,
      currentPage: 120,
      tags: ["技術"],
      status: "paused",
      createdAt: iso(12),
      updatedAt: iso(5),
    },
  ],
  progressLogs: [
    {
      id: "a1",
      bookId: BOOK1,
      page: 90,
      memo: "第2章まで。環境を整えるのが先。",
      status: "reading",
      loggedAt: iso(2),
    },
    {
      id: "a2",
      bookId: BOOK1,
      page: 140,
      memo: "第3章。1%改善の複利。",
      status: "reading",
      loggedAt: iso(1),
    },
    { id: "b1", bookId: BOOK2, page: 300, memo: "終盤", status: "reading", loggedAt: iso(4) },
    { id: "b2", bookId: BOOK2, page: 360, memo: "読了！", status: "completed", loggedAt: iso(3) },
    { id: "d1", bookId: BOOK4, page: 120, memo: "一旦保留", status: "paused", loggedAt: iso(5) },
  ],
};

const shots = [
  { path: "/", file: "dashboard.png", wait: '[data-testid="dashboard-page"]' },
  { path: "/stats", file: "stats.png", wait: '[data-testid="stats-page"]' },
  { path: `/books/${BOOK1}`, file: "book-detail.png", wait: '[data-testid="book-detail-page"]' },
];

const main = async () => {
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript((payload) => {
    window.localStorage.setItem("book-reading-record.v1", JSON.stringify(payload));
  }, seed);

  const page = await context.newPage();

  for (const shot of shots) {
    await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: "networkidle" });
    await page.waitForSelector(shot.wait, { timeout: 20000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(OUT_DIR, shot.file), fullPage: true });
    console.log(`saved docs/assets/${shot.file}`);
  }

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
