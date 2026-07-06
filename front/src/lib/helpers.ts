import {
  INITIAL_STORAGE_PAYLOAD,
  RECOVERY_NOTICE_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  STATUS_ORDER,
} from "./constants";
import { Book, BookStatus, ProgressLog, StoragePayload, WeeklySummary } from "./types";

// ISO 日時文字列を降順比較する（新しい日時ほど前）。
const byDateDesc = (a: string, b: string): number => {
  return new Date(b).getTime() - new Date(a).getTime();
};

/**
 * 書籍一覧をダッシュボード表示順（updatedAt 降順 → createdAt 降順 → id 昇順）に並べ替える。
 * 元配列は破壊しない。
 *
 * @param books - 並べ替え対象の書籍配列
 * @returns 新しい順に整列した新しい配列
 */
export const sortBooks = (books: Book[]): Book[] => {
  return [...books].sort((a, b) => {
    const updatedDiff = byDateDesc(a.updatedAt, b.updatedAt);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    const createdDiff = byDateDesc(a.createdAt, b.createdAt);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return a.id.localeCompare(b.id);
  });
};

/**
 * 進捗ログを記録日時の降順（loggedAt 降順 → id 昇順）に並べ替える。元配列は破壊しない。
 *
 * @param logs - 並べ替え対象の進捗ログ配列
 * @returns 新しい順に整列した新しい配列
 */
export const sortLogsDesc = (logs: ProgressLog[]): ProgressLog[] => {
  return [...logs].sort((a, b) => {
    const loggedDiff = byDateDesc(a.loggedAt, b.loggedAt);
    if (loggedDiff !== 0) {
      return loggedDiff;
    }

    return a.id.localeCompare(b.id);
  });
};

/**
 * 進捗ログを記録日時の昇順に並べ替える。週次集計の差分計算で古い順に走査するために使う。
 *
 * @param logs - 並べ替え対象の進捗ログ配列
 * @returns 古い順に整列した新しい配列
 */
export const sortLogsAsc = (logs: ProgressLog[]): ProgressLog[] => {
  return sortLogsDesc(logs).reverse();
};

/**
 * ステータスの表示順インデックスを返す。
 *
 * @param status - 対象ステータス
 * @returns STATUS_ORDER 内の位置（0 起点）
 */
export const getStatusOrder = (status: BookStatus): number => {
  return STATUS_ORDER.indexOf(status);
};

/**
 * 書籍が「感想未記入」かを判定する。感想未登録、または学び/行動/一文がすべて空（trim 後）なら true。
 *
 * @param book - 判定対象の書籍
 * @returns 感想未記入なら true
 */
export const reflectionIsMissing = (book: Book): boolean => {
  if (!book.reflection) {
    return true;
  }

  return [book.reflection.learning, book.reflection.action, book.reflection.quote].every(
    (value) => value.trim().length === 0
  );
};

// ペイロードをディープコピーする。呼び出し側が localStorage 内の参照を直接変更しないための防御。
const clonePayload = (payload: StoragePayload): StoragePayload => {
  return JSON.parse(JSON.stringify(payload)) as StoragePayload;
};

// 未知の値が StoragePayload の最低限の構造（version 数値・books/progressLogs 配列）を満たすかを検査する。
const isValidPayload = (value: unknown): value is StoragePayload => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoragePayload>;
  return (
    typeof candidate.version === "number" &&
    Array.isArray(candidate.books) &&
    Array.isArray(candidate.progressLogs)
  );
};

/**
 * 一意な ID を生成する。`crypto.randomUUID` があれば使い、
 * 非対応環境（古いブラウザ等）では時刻＋乱数のフォールバックで代替する。
 *
 * @returns 生成した ID 文字列
 */
export const createId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

/**
 * localStorage から永続化ペイロードを読み込む。
 *
 * 未設定時は初期値を書き込んで返す。JSON parse 失敗・スキーマ不一致・バージョン相違は
 * 破損とみなし、生データを `*.bak.<timestamp>` へ退避 → 初期化 → 復旧通知フラグを立てて
 * クラッシュを避ける（docs/05-data-specification.md §5・§6）。SSR（window 未定義）では初期値を返す。
 *
 * @returns 有効なペイロード（破損時は初期化済みのもの）
 */
export const parseStoragePayload = (): StoragePayload => {
  if (typeof window === "undefined") {
    return clonePayload(INITIAL_STORAGE_PAYLOAD);
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const initial = clonePayload(INITIAL_STORAGE_PAYLOAD);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidPayload(parsed) || parsed.version !== STORAGE_VERSION) {
      throw new Error("Invalid payload");
    }

    return clonePayload(parsed);
  } catch {
    // 破損データは失わないようバックアップへ退避してから初期化する。
    const now = new Date().toISOString();
    window.localStorage.setItem(`${STORAGE_KEY}.bak.${now}`, raw);

    const initial = clonePayload(INITIAL_STORAGE_PAYLOAD);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    window.localStorage.setItem(RECOVERY_NOTICE_KEY, now);

    return initial;
  }
};

/**
 * 永続化ペイロードを localStorage に書き込む。SSR（window 未定義）では何もしない。
 *
 * @param payload - 保存するペイロード
 */
export const persistStoragePayload = (payload: StoragePayload): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

/**
 * 破損復旧通知を1回だけ取り出す。読み取ると同時にフラグを消すため、UI で復旧メッセージを一度だけ表示できる。
 *
 * @returns 復旧が発生していれば退避時刻（ISO 文字列）、なければ null
 */
export const consumeRecoveryNotice = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(RECOVERY_NOTICE_KEY);
  if (!value) {
    return null;
  }

  window.localStorage.removeItem(RECOVERY_NOTICE_KEY);
  return value;
};

/**
 * 直近7日（当日含む）の週次サマリーを集計する。期間はクライアントのローカルタイムゾーンで
 * 「当日 0:00 − 6日」を起点とする。読了ページ数は書籍ごとに古い順のログ間差分を積み上げ、
 * 負の差分は 0 に丸める（期間内最初のログは 0 起点）。
 *
 * @param books - 集計対象の書籍（感想数の判定に使う）
 * @param logs - 集計対象の進捗ログ
 * @returns 読了ページ数・進捗記録回数・感想数
 */
export const computeWeeklySummary = (books: Book[], logs: ProgressLog[]): WeeklySummary => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const inWindow = logs.filter((log) => {
    const loggedAt = new Date(log.loggedAt);
    return loggedAt >= start && loggedAt <= now;
  });

  // 読了ページは同一書籍の連続ログ間の差分で数えるため、書籍ごとにグループ化する。
  const byBook = new Map<string, ProgressLog[]>();
  for (const log of inWindow) {
    const entries = byBook.get(log.bookId) ?? [];
    entries.push(log);
    byBook.set(log.bookId, entries);
  }

  let readPages = 0;

  for (const entries of byBook.values()) {
    const sorted = sortLogsAsc(entries);
    let previousPage = 0;

    for (const entry of sorted) {
      const diff = entry.page - previousPage;
      // 読み戻し（負の差分）は読了ページに含めない。
      readPages += Math.max(diff, 0);
      previousPage = entry.page;
    }
  }

  const reflectionCount = books.filter((book) => {
    if (!book.reflection) {
      return false;
    }

    const createdAt = new Date(book.reflection.createdAt);
    return createdAt >= start && createdAt <= now;
  }).length;

  return {
    readPages,
    progressCount: inWindow.length,
    reflectionCount,
  };
};
