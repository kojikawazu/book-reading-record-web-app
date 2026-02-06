import { BookFormat, BookStatus } from "./types";

export const STORAGE_KEY = "book-reading-record.v1";
export const STORAGE_VERSION = 1;
export const RECOVERY_NOTICE_KEY = `${STORAGE_KEY}.recoveryNotice`;

export const STATUS_LABELS: Record<BookStatus, string> = {
  not_started: "読書前",
  reading: "読書中",
  paused: "保留",
  completed: "完読",
};

export const FORMAT_LABELS: Record<BookFormat, string> = {
  paper: "紙",
  ebook: "電子",
  audio: "音声",
};

export const STATUS_ORDER: BookStatus[] = ["not_started", "reading", "paused", "completed"];

export const INITIAL_STORAGE_PAYLOAD = {
  version: STORAGE_VERSION,
  books: [],
  progressLogs: [],
};
