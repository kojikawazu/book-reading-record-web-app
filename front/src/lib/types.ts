/**
 * 書籍のステータス。読書前 → 読書中 ⇄ 保留 → 完読、および完読 → 読書中（再読）を遷移する。
 * 遷移ルールは docs/03-functional-specification.md 第2部を正とする。
 */
export type BookStatus = "not_started" | "reading" | "paused" | "completed";

/** 読書形式（紙 / 電子 / 音声）。 */
export type BookFormat = "paper" | "ebook" | "audio";

/**
 * 完読時の感想。学び / 行動 / 一文はいずれも空入力可で、
 * 3項目すべてが空（trim 後）なら「感想未記入」として扱う（helpers.reflectionIsMissing）。
 */
export interface Reflection {
  learning: string;
  action: string;
  quote: string;
  createdAt: string;
}

/** 書籍1冊のドメインモデル。`local` / `supabase` の両モードで共通の論理形。 */
export interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  format: BookFormat;
  totalPages: number;
  /** 現在ページ（絶対値）。登録直後は 0、再読開始時に 0 へリセットする。 */
  currentPage: number;
  tags: string[];
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  /** 完読日時。未完読・再読中は undefined。 */
  completedAt?: string;
  /** 完読時感想。再読しても保持する（初期化しない）。 */
  reflection?: Reflection;
}

/** 進捗記録1件。追記のみで更新・削除しない（進捗履歴）。 */
export interface ProgressLog {
  id: string;
  bookId: string;
  page: number;
  memo?: string;
  status: BookStatus;
  loggedAt: string;
}

/**
 * `local` モードで localStorage に保存する永続化ペイロード。
 * `version` はスキーマ判定に使い、不一致・破損時は初期化する（helpers.parseStoragePayload）。
 */
export interface StoragePayload {
  version: number;
  books: Book[];
  progressLogs: ProgressLog[];
}

/** 書籍作成の入力。初期ステータスに `completed` は指定できない（型で除外）。 */
export interface CreateBookInput {
  title: string;
  author: string;
  genre?: string;
  format: BookFormat;
  totalPages: number;
  tags: string[];
  status: Exclude<BookStatus, "completed">;
}

/** 書籍更新の入力。指定したフィールドのみ部分更新する（再読・完読の状態変更を含む）。 */
export interface UpdateBookInput {
  title?: string;
  author?: string;
  genre?: string;
  format?: BookFormat;
  totalPages?: number;
  currentPage?: number;
  tags?: string[];
  status?: BookStatus;
  /** 明示的に undefined を渡すと完読解除（再読）を表現する。 */
  completedAt?: string | undefined;
  reflection?: Reflection;
}

/** 進捗記録の入力。`loggedAt` 省略時は現在時刻を記録日とする。 */
export interface CreateProgressLogInput {
  page: number;
  memo?: string;
  status: BookStatus;
  loggedAt?: string;
}

/** 感想保存の入力（3項目とも空入力可）。 */
export interface ReflectionInput {
  learning: string;
  action: string;
  quote: string;
}

/** 直近7日（当日含む）の週次集計結果。 */
export interface WeeklySummary {
  readPages: number;
  progressCount: number;
  reflectionCount: number;
}
