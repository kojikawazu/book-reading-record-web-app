export type BookStatus = "not_started" | "reading" | "paused" | "completed";

export type BookFormat = "paper" | "ebook" | "audio";

export interface Reflection {
  learning: string;
  action: string;
  quote: string;
  createdAt: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  genre?: string;
  format: BookFormat;
  totalPages: number;
  currentPage: number;
  tags: string[];
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  reflection?: Reflection;
}

export interface ProgressLog {
  id: string;
  bookId: string;
  page: number;
  memo?: string;
  status: BookStatus;
  loggedAt: string;
}

export interface StoragePayload {
  version: number;
  books: Book[];
  progressLogs: ProgressLog[];
}

export interface CreateBookInput {
  title: string;
  author: string;
  genre?: string;
  format: BookFormat;
  totalPages: number;
  tags: string[];
  status: Exclude<BookStatus, "completed">;
}

export interface UpdateBookInput {
  title?: string;
  author?: string;
  genre?: string;
  format?: BookFormat;
  totalPages?: number;
  currentPage?: number;
  tags?: string[];
  status?: BookStatus;
  completedAt?: string | undefined;
  reflection?: Reflection;
}

export interface CreateProgressLogInput {
  page: number;
  memo?: string;
  status: BookStatus;
  loggedAt?: string;
}

export interface ReflectionInput {
  learning: string;
  action: string;
  quote: string;
}

export interface WeeklySummary {
  readPages: number;
  progressCount: number;
  reflectionCount: number;
}
