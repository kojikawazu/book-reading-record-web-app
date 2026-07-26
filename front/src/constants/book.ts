import { BookFormat, BookStatus } from "@/types/book";

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
