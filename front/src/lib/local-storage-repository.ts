import { BookRepository } from "./repository";
import {
  Book,
  CreateBookInput,
  CreateProgressLogInput,
  ProgressLog,
  ReflectionInput,
  StoragePayload,
  UpdateBookInput,
} from "./types";
import {
  createId,
  parseStoragePayload,
  persistStoragePayload,
  sortBooks,
  sortLogsDesc,
} from "./helpers";
import { validateReflection } from "./validation";

const nowIso = (): string => new Date().toISOString();

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class LocalStorageRepository implements BookRepository {
  async listBooks(): Promise<Book[]> {
    const payload = parseStoragePayload();
    return sortBooks(payload.books);
  }

  async getBook(bookId: string): Promise<Book | null> {
    const payload = parseStoragePayload();
    const book = payload.books.find((item) => item.id === bookId);
    return book ? copy(book) : null;
  }

  async listProgressLogs(bookId: string): Promise<ProgressLog[]> {
    const payload = parseStoragePayload();
    const logs = payload.progressLogs.filter((log) => log.bookId === bookId);
    return sortLogsDesc(logs);
  }

  async createBook(input: CreateBookInput): Promise<Book> {
    const payload = parseStoragePayload();
    const now = nowIso();

    const book: Book = {
      id: createId(),
      title: input.title.trim(),
      author: input.author.trim(),
      genre: input.genre?.trim() || undefined,
      format: input.format,
      totalPages: input.totalPages,
      currentPage: 0,
      tags: input.tags,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      completedAt: undefined,
      reflection: undefined,
    };

    payload.books.push(book);
    persistStoragePayload(payload);

    return copy(book);
  }

  async updateBook(bookId: string, patch: UpdateBookInput): Promise<Book> {
    const payload = parseStoragePayload();
    const index = payload.books.findIndex((item) => item.id === bookId);

    if (index < 0) {
      throw new Error("対象の書籍が見つかりません。");
    }

    const source = payload.books[index];
    const merged: Book = {
      ...source,
      ...patch,
      title: patch.title !== undefined ? patch.title.trim() : source.title,
      author: patch.author !== undefined ? patch.author.trim() : source.author,
      genre:
        patch.genre !== undefined
          ? patch.genre.trim().length > 0
            ? patch.genre.trim()
            : undefined
          : source.genre,
      updatedAt: nowIso(),
    };

    if (merged.currentPage >= merged.totalPages) {
      merged.status = "completed";
    }

    if (merged.status === "completed" && merged.currentPage < merged.totalPages) {
      throw new Error("完読にするには到達ページを総ページ以上にしてください。");
    }

    if (merged.status === "completed") {
      merged.completedAt = merged.completedAt ?? nowIso();
    } else {
      merged.completedAt = undefined;
    }

    payload.books[index] = merged;
    persistStoragePayload(payload);

    return copy(merged);
  }

  async addProgressLog(
    bookId: string,
    input: CreateProgressLogInput
  ): Promise<{ book: Book; log: ProgressLog }> {
    const payload = parseStoragePayload();
    const index = payload.books.findIndex((item) => item.id === bookId);

    if (index < 0) {
      throw new Error("対象の書籍が見つかりません。");
    }

    const source = payload.books[index];
    let status = input.status;

    if (input.page >= source.totalPages) {
      status = "completed";
    }

    if (status === "completed" && input.page < source.totalPages) {
      throw new Error("完読にするには到達ページを総ページ以上にしてください。");
    }

    const log: ProgressLog = {
      id: createId(),
      bookId,
      page: input.page,
      memo: input.memo?.trim() || undefined,
      status,
      loggedAt: input.loggedAt ?? nowIso(),
    };

    const book: Book = {
      ...source,
      currentPage: input.page,
      status,
      updatedAt: nowIso(),
      completedAt:
        status === "completed" ? (source.completedAt ?? input.loggedAt ?? nowIso()) : undefined,
    };

    payload.progressLogs.push(log);
    payload.books[index] = book;
    persistStoragePayload(payload);

    return {
      book: copy(book),
      log: copy(log),
    };
  }

  async saveReflection(bookId: string, input: ReflectionInput): Promise<Book> {
    const payload = parseStoragePayload();
    const index = payload.books.findIndex((item) => item.id === bookId);

    if (index < 0) {
      throw new Error("対象の書籍が見つかりません。");
    }

    const validationErrors = validateReflection(input);
    if (Object.keys(validationErrors).length > 0) {
      const message = Object.values(validationErrors)[0] ?? "感想の入力が不正です。";
      throw new Error(message);
    }

    const source = payload.books[index];
    const createdAt = source.reflection?.createdAt ?? nowIso();

    const reflection = {
      learning: input.learning,
      action: input.action,
      quote: input.quote,
      createdAt,
    };

    const book: Book = {
      ...source,
      reflection,
      updatedAt: nowIso(),
    };

    payload.books[index] = book;
    persistStoragePayload(payload);

    return copy(book);
  }

  async searchBooks(query: string): Promise<Book[]> {
    const trimmed = query.trim().toLocaleLowerCase();
    const books = await this.listBooks();

    if (!trimmed) {
      return books;
    }

    return books.filter((book) => {
      const target = [book.title, book.author, ...(book.tags ?? [])].join(" ").toLocaleLowerCase();
      return target.includes(trimmed);
    });
  }

  readRawPayload(): StoragePayload {
    return parseStoragePayload();
  }
}
