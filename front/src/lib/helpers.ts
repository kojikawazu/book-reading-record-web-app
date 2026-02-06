import {
  INITIAL_STORAGE_PAYLOAD,
  RECOVERY_NOTICE_KEY,
  STORAGE_KEY,
  STORAGE_VERSION,
  STATUS_ORDER,
} from "./constants";
import { Book, BookStatus, ProgressLog, StoragePayload, WeeklySummary } from "./types";

const byDateDesc = (a: string, b: string): number => {
  return new Date(b).getTime() - new Date(a).getTime();
};

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

export const sortLogsDesc = (logs: ProgressLog[]): ProgressLog[] => {
  return [...logs].sort((a, b) => {
    const loggedDiff = byDateDesc(a.loggedAt, b.loggedAt);
    if (loggedDiff !== 0) {
      return loggedDiff;
    }

    return a.id.localeCompare(b.id);
  });
};

export const sortLogsAsc = (logs: ProgressLog[]): ProgressLog[] => {
  return sortLogsDesc(logs).reverse();
};

export const getStatusOrder = (status: BookStatus): number => {
  return STATUS_ORDER.indexOf(status);
};

export const reflectionIsMissing = (book: Book): boolean => {
  if (!book.reflection) {
    return true;
  }

  return [book.reflection.learning, book.reflection.action, book.reflection.quote].every(
    (value) => value.trim().length === 0
  );
};

const clonePayload = (payload: StoragePayload): StoragePayload => {
  return JSON.parse(JSON.stringify(payload)) as StoragePayload;
};

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

export const createId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

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
    const now = new Date().toISOString();
    window.localStorage.setItem(`${STORAGE_KEY}.bak.${now}`, raw);

    const initial = clonePayload(INITIAL_STORAGE_PAYLOAD);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    window.localStorage.setItem(RECOVERY_NOTICE_KEY, now);

    return initial;
  }
};

export const persistStoragePayload = (payload: StoragePayload): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

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

export const computeWeeklySummary = (books: Book[], logs: ProgressLog[]): WeeklySummary => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const inWindow = logs.filter((log) => {
    const loggedAt = new Date(log.loggedAt);
    return loggedAt >= start && loggedAt <= now;
  });

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
