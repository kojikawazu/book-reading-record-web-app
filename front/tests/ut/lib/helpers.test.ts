import { beforeEach, describe, it, expect } from "vitest";
import {
  computeWeeklySummary,
  consumeRecoveryNotice,
  createId,
  formatProgress,
  getStatusOrder,
  hasKnownTotalPages,
  isCompletedByProgress,
  parseStoragePayload,
  persistStoragePayload,
  reflectionIsMissing,
  sortBooks,
  sortLogsAsc,
  sortLogsDesc,
} from "@/lib/helpers";
import { RECOVERY_NOTICE_KEY, STORAGE_KEY, STORAGE_VERSION } from "@/constants/storage";
import { Book, ProgressLog } from "@/types/book";

const makeBook = (overrides: Partial<Book> = {}): Book => ({
  id: "b1",
  title: "t",
  author: "a",
  format: "paper",
  totalPages: 100,
  currentPage: 0,
  tags: [],
  status: "reading",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeLog = (overrides: Partial<ProgressLog> = {}): ProgressLog => ({
  id: "l1",
  bookId: "b1",
  page: 0,
  status: "reading",
  loggedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const daysAgoIso = (days: number): string => new Date(Date.now() - days * 86_400_000).toISOString();

describe("sortBooks", () => {
  // --- 正常系 ---
  it("updatedAt 降順で並べ替える", () => {
    const books = [
      makeBook({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
      makeBook({ id: "new", updatedAt: "2026-01-03T00:00:00.000Z" }),
      makeBook({ id: "mid", updatedAt: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(sortBooks(books).map((b) => b.id)).toEqual(["new", "mid", "old"]);
  });

  it("updatedAt 同値なら createdAt 降順 → id 昇順で決定する", () => {
    const at = "2026-01-05T00:00:00.000Z";
    const books = [
      makeBook({ id: "b", updatedAt: at, createdAt: "2026-01-01T00:00:00.000Z" }),
      makeBook({ id: "a", updatedAt: at, createdAt: "2026-01-01T00:00:00.000Z" }),
      makeBook({ id: "c", updatedAt: at, createdAt: "2026-01-02T00:00:00.000Z" }),
    ];
    expect(sortBooks(books).map((b) => b.id)).toEqual(["c", "a", "b"]);
  });

  it("元配列を破壊しない", () => {
    const books = [makeBook({ id: "x" }), makeBook({ id: "y" })];
    sortBooks(books);
    expect(books.map((b) => b.id)).toEqual(["x", "y"]);
  });
});

describe("sortLogsDesc / sortLogsAsc", () => {
  const logs = [
    makeLog({ id: "l1", loggedAt: "2026-01-01T00:00:00.000Z" }),
    makeLog({ id: "l3", loggedAt: "2026-01-03T00:00:00.000Z" }),
    makeLog({ id: "l2", loggedAt: "2026-01-02T00:00:00.000Z" }),
  ];

  it("降順（新しい順）で並べる", () => {
    expect(sortLogsDesc(logs).map((l) => l.id)).toEqual(["l3", "l2", "l1"]);
  });

  it("昇順（古い順）で並べる", () => {
    expect(sortLogsAsc(logs).map((l) => l.id)).toEqual(["l1", "l2", "l3"]);
  });
});

describe("getStatusOrder", () => {
  it("STATUS_ORDER のインデックスを返す", () => {
    expect(getStatusOrder("not_started")).toBe(0);
    expect(getStatusOrder("reading")).toBe(1);
    expect(getStatusOrder("paused")).toBe(2);
    expect(getStatusOrder("completed")).toBe(3);
  });
});

describe("reflectionIsMissing", () => {
  // --- 正常系 ---
  it("感想が1項目でも埋まっていれば false", () => {
    const book = makeBook({
      reflection: { learning: "学び", action: "", quote: "", createdAt: daysAgoIso(0) },
    });
    expect(reflectionIsMissing(book)).toBe(false);
  });

  // --- 準正常系 ---
  it("reflection 未登録なら true", () => {
    expect(reflectionIsMissing(makeBook())).toBe(true);
  });

  it("3項目すべて空白のみなら true", () => {
    const book = makeBook({
      reflection: { learning: "  ", action: "\t", quote: "", createdAt: daysAgoIso(0) },
    });
    expect(reflectionIsMissing(book)).toBe(true);
  });
});

describe("hasKnownTotalPages", () => {
  // --- 正常系 ---
  it("1 以上なら入力済みと判定する", () => {
    expect(hasKnownTotalPages(1)).toBe(true);
    expect(hasKnownTotalPages(300)).toBe(true);
  });

  // --- 準正常系 ---
  it("0（未入力）なら false", () => {
    expect(hasKnownTotalPages(0)).toBe(false);
  });

  it("負数なら false", () => {
    expect(hasKnownTotalPages(-1)).toBe(false);
  });
});

describe("isCompletedByProgress", () => {
  // --- 正常系 ---
  it("到達ページが総ページ以上なら完読と判定する", () => {
    expect(isCompletedByProgress(300, 300)).toBe(true);
    expect(isCompletedByProgress(301, 300)).toBe(true);
  });

  // --- 準正常系 ---
  it("到達ページが総ページ未満なら完読ではない", () => {
    expect(isCompletedByProgress(299, 300)).toBe(false);
  });

  // --- 異常系（未入力を分母にしない）---
  it("総ページ数が未入力ならページ数に関わらず false", () => {
    // 0 を分母とみなすと currentPage >= 0 が常に成立し、全書籍が完読になってしまう。
    expect(isCompletedByProgress(0, 0)).toBe(false);
    expect(isCompletedByProgress(9999, 0)).toBe(false);
  });
});

describe("formatProgress", () => {
  // --- 正常系 ---
  it("総ページ数が入力済みなら分母と進捗率を出す", () => {
    expect(formatProgress(makeBook({ currentPage: 12, totalPages: 300 }))).toBe("12 / 300 (4%)");
  });

  it("進捗率は小数第1位まで丸める", () => {
    expect(formatProgress(makeBook({ currentPage: 100, totalPages: 260 }))).toBe(
      "100 / 260 (38.5%)"
    );
  });

  // --- 準正常系 ---
  it("総ページ数が未入力なら分母も進捗率も出さない", () => {
    expect(formatProgress(makeBook({ currentPage: 12, totalPages: 0 }))).toBe("12 ページ");
  });

  it("未入力かつ未読なら 0 ページと表示する", () => {
    expect(formatProgress(makeBook({ currentPage: 0, totalPages: 0 }))).toBe("0 ページ");
  });
});

describe("createId", () => {
  it("空でない文字列を返し、呼び出しごとに異なる", () => {
    const a = createId();
    const b = createId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});

describe("computeWeeklySummary", () => {
  // --- 正常系 ---
  it("直近7日の読了ページ・進捗回数・感想数を集計する", () => {
    const books = [
      makeBook({
        reflection: { learning: "x", action: "", quote: "", createdAt: daysAgoIso(1) },
      }),
    ];
    const logs = [
      makeLog({ id: "in1", page: 10, loggedAt: daysAgoIso(2) }),
      makeLog({ id: "in2", page: 30, loggedAt: daysAgoIso(1) }),
      makeLog({ id: "out", page: 100, loggedAt: daysAgoIso(8) }),
    ];
    expect(computeWeeklySummary(books, logs)).toEqual({
      readPages: 30,
      progressCount: 2,
      reflectionCount: 1,
    });
  });

  // --- 準正常系 ---
  it("読み戻し（負の差分）は読了ページに数えない", () => {
    const logs = [
      makeLog({ id: "a", page: 50, loggedAt: daysAgoIso(3) }),
      makeLog({ id: "b", page: 20, loggedAt: daysAgoIso(1) }),
    ];
    expect(computeWeeklySummary([], logs).readPages).toBe(50);
  });

  it("ログなしはすべてゼロ", () => {
    expect(computeWeeklySummary([], [])).toEqual({
      readPages: 0,
      progressCount: 0,
      reflectionCount: 0,
    });
  });
});

describe("localStorage ペイロード（parse / persist / recovery）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  // --- 正常系 ---
  it("未設定時は初期値を返してキーを書き込む", () => {
    const payload = parseStoragePayload();
    expect(payload).toEqual({ version: STORAGE_VERSION, books: [], progressLogs: [] });
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("persist した内容を読み戻せる", () => {
    persistStoragePayload({ version: STORAGE_VERSION, books: [makeBook()], progressLogs: [] });
    expect(parseStoragePayload().books).toHaveLength(1);
  });

  // --- 異常系 ---
  it("壊れた JSON はバックアップ退避のうえ初期化し、復旧通知を立てる", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ broken json");
    const payload = parseStoragePayload();

    expect(payload.books).toEqual([]);
    const backupKey = Object.keys(window.localStorage).find((k) =>
      k.startsWith(`${STORAGE_KEY}.bak.`)
    );
    expect(backupKey).toBeDefined();
    expect(window.localStorage.getItem(RECOVERY_NOTICE_KEY)).not.toBeNull();
  });

  it("バージョン不一致ペイロードは破損扱いで初期化する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 999, books: [makeBook()], progressLogs: [] })
    );
    expect(parseStoragePayload().books).toEqual([]);
  });

  it("books が配列でないペイロードは破損扱いで初期化する", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, books: "nope", progressLogs: [] })
    );
    expect(parseStoragePayload().books).toEqual([]);
  });

  it("consumeRecoveryNotice は1回だけ値を返し、以後は null", () => {
    window.localStorage.setItem(RECOVERY_NOTICE_KEY, "2026-07-06T00:00:00.000Z");
    expect(consumeRecoveryNotice()).toBe("2026-07-06T00:00:00.000Z");
    expect(consumeRecoveryNotice()).toBeNull();
  });
});
