import { BookFormat, BookStatus } from "./types";

/** `local` モードの localStorage 保存キー。バージョンをキー名に含める。 */
export const STORAGE_KEY = "book-reading-record.v1";
/** 永続化ペイロードのスキーマバージョン。値が変わる移行時は再初期化する。 */
export const STORAGE_VERSION = 1;
/** 破損データ復旧の通知フラグを保持する localStorage キー。 */
export const RECOVERY_NOTICE_KEY = `${STORAGE_KEY}.recoveryNotice`;

/** ステータスの日本語表示ラベル。 */
export const STATUS_LABELS: Record<BookStatus, string> = {
  not_started: "読書前",
  reading: "読書中",
  paused: "保留",
  completed: "完読",
};

/** 読書形式の日本語表示ラベル。 */
export const FORMAT_LABELS: Record<BookFormat, string> = {
  paper: "紙",
  ebook: "電子",
  audio: "音声",
};

/** ダッシュボードのセクション表示順に対応するステータス並び。 */
export const STATUS_ORDER: BookStatus[] = ["not_started", "reading", "paused", "completed"];

/** localStorage 未設定時・破損復旧時に書き込む初期ペイロード。 */
export const INITIAL_STORAGE_PAYLOAD = {
  version: STORAGE_VERSION,
  books: [],
  progressLogs: [],
};
