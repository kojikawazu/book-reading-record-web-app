import "server-only";

import type { BookRecordBook, BookRecordProgressLog, BookRecordReflection } from "@prisma/client";
import { BookRepository } from "@/lib/repository";
import {
  Book,
  BookFormat,
  BookStatus,
  CreateBookInput,
  CreateProgressLogInput,
  ProgressLog,
  Reflection,
  ReflectionInput,
  UpdateBookInput,
} from "@/lib/types";
import { validateReflection } from "@/lib/validation";
import { prisma } from "./prisma-client";

const BOOK_STATUS_VALUES: BookStatus[] = ["not_started", "reading", "paused", "completed"];
const BOOK_FORMAT_VALUES: BookFormat[] = ["paper", "ebook", "audio"];

const isIntegerInRange = (value: number, min: number, max: number): boolean => {
  return Number.isInteger(value) && value >= min && value <= max;
};

const isBookStatus = (value: string): value is BookStatus => {
  return BOOK_STATUS_VALUES.includes(value as BookStatus);
};

const isBookFormat = (value: string): value is BookFormat => {
  return BOOK_FORMAT_VALUES.includes(value as BookFormat);
};

const normalizeTags = (tags: string[]): string[] => {
  return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
};

const firstValidationMessage = (errors: Record<string, string>): string => {
  return Object.values(errors)[0] ?? "入力内容が不正です。";
};

const toReflection = (row: BookRecordReflection | null): Reflection | undefined => {
  if (!row) {
    return undefined;
  }

  return {
    learning: row.learning,
    action: row.action,
    quote: row.quote,
    createdAt: row.createdAt.toISOString(),
  };
};

const toBook = (
  row: BookRecordBook & {
    reflection: BookRecordReflection | null;
  }
): Book => {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    genre: row.genre ?? undefined,
    format: row.format as BookFormat,
    totalPages: row.totalPages,
    currentPage: row.currentPage,
    tags: row.tags,
    status: row.status as BookStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    reflection: toReflection(row.reflection),
  };
};

const toProgressLog = (row: BookRecordProgressLog): ProgressLog => {
  return {
    id: row.id,
    bookId: row.bookId,
    page: row.page,
    memo: row.memo ?? undefined,
    status: row.status as BookStatus,
    loggedAt: row.loggedAt.toISOString(),
  };
};

type BookDraft = {
  title: string;
  author: string;
  genre?: string;
  format: BookFormat;
  totalPages: number;
  currentPage: number;
  tags: string[];
  status: BookStatus;
};

const validateBookDraft = (
  input: BookDraft,
  options: {
    allowCompletedStatus: boolean;
  }
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (input.title.trim().length < 1 || input.title.trim().length > 200) {
    errors.title = "タイトルは1〜200文字で入力してください。";
  }

  if (input.author.trim().length < 1 || input.author.trim().length > 120) {
    errors.author = "著者は1〜120文字で入力してください。";
  }

  if ((input.genre ?? "").trim().length > 80) {
    errors.genre = "ジャンルは80文字以内で入力してください。";
  }

  if (!isIntegerInRange(input.totalPages, 1, 100000)) {
    errors.totalPages = "総ページ数は1〜100000の整数で入力してください。";
  }

  if (!isIntegerInRange(input.currentPage, 0, 100000)) {
    errors.currentPage = "現在ページは0〜100000の整数で入力してください。";
  }

  if (input.tags.length > 10) {
    errors.tags = "タグは最大10件までです。";
  } else if (input.tags.some((tag) => tag.length < 1 || tag.length > 30)) {
    errors.tags = "タグは1〜30文字で入力してください。";
  }

  if (!isBookFormat(input.format)) {
    errors.format = "読書形式が不正です。";
  }

  if (!isBookStatus(input.status)) {
    errors.status = "ステータスが不正です。";
  } else if (!options.allowCompletedStatus && input.status === "completed") {
    errors.status = "初期ステータスに完読は指定できません。";
  }

  return errors;
};

const validateProgressDraft = (input: {
  page: number;
  totalPages: number;
  status: BookStatus;
  memo: string;
}): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!isIntegerInRange(input.page, 0, 100000)) {
    errors.page = "到達ページは0〜100000の整数で入力してください。";
  }

  if (input.memo.length > 5000) {
    errors.memo = "メモは5000文字以内で入力してください。";
  }

  if (!isBookStatus(input.status)) {
    errors.status = "ステータスが不正です。";
  }

  if (input.status === "completed" && input.page < input.totalPages) {
    errors.status = "完読にするには到達ページを総ページ以上にしてください。";
  }

  return errors;
};

const parseLoggedAt = (loggedAt: string | undefined): Date => {
  if (!loggedAt) {
    return new Date();
  }

  const parsed = new Date(loggedAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new RepositoryValidationError("記録日が不正です。");
  }

  return parsed;
};

export class RepositoryValidationError extends Error {
  readonly statusCode = 400;
}

export class RepositoryNotFoundError extends Error {
  readonly statusCode = 404;
}

export const isRepositoryError = (
  value: unknown
): value is RepositoryValidationError | RepositoryNotFoundError => {
  return (
    value instanceof RepositoryValidationError ||
    value instanceof RepositoryNotFoundError
  );
};

export class PrismaBookRecordRepository implements BookRepository {
  async listBooks(): Promise<Book[]> {
    const books = await prisma.bookRecordBook.findMany({
      include: {
        reflection: true,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    });

    return books.map((book) => toBook(book));
  }

  async getBook(bookId: string): Promise<Book | null> {
    const book = await prisma.bookRecordBook.findUnique({
      where: { id: bookId },
      include: {
        reflection: true,
      },
    });

    return book ? toBook(book) : null;
  }

  async listProgressLogs(bookId: string): Promise<ProgressLog[]> {
    const logs = await prisma.bookRecordProgressLog.findMany({
      where: {
        bookId,
      },
      orderBy: [{ loggedAt: "desc" }, { id: "asc" }],
    });

    return logs.map((log) => toProgressLog(log));
  }

  async createBook(input: CreateBookInput): Promise<Book> {
    const draft: BookDraft = {
      title: input.title,
      author: input.author,
      genre: input.genre,
      format: input.format,
      totalPages: input.totalPages,
      currentPage: 0,
      tags: normalizeTags(input.tags),
      status: input.status,
    };

    const validationErrors = validateBookDraft(draft, { allowCompletedStatus: false });
    if (Object.keys(validationErrors).length > 0) {
      throw new RepositoryValidationError(firstValidationMessage(validationErrors));
    }

    const created = await prisma.bookRecordBook.create({
      data: {
        title: draft.title.trim(),
        author: draft.author.trim(),
        genre: draft.genre?.trim() ? draft.genre.trim() : null,
        format: draft.format as BookRecordBook["format"],
        totalPages: draft.totalPages,
        currentPage: 0,
        tags: draft.tags,
        status: draft.status as BookRecordBook["status"],
        completedAt: null,
      },
      include: {
        reflection: true,
      },
    });

    return toBook(created);
  }

  async updateBook(bookId: string, patch: UpdateBookInput): Promise<Book> {
    const source = await prisma.bookRecordBook.findUnique({
      where: { id: bookId },
      include: {
        reflection: true,
      },
    });

    if (!source) {
      throw new RepositoryNotFoundError("対象の書籍が見つかりません。");
    }

    const merged: BookDraft = {
      title: patch.title ?? source.title,
      author: patch.author ?? source.author,
      genre: patch.genre ?? source.genre ?? undefined,
      format: (patch.format ?? source.format) as BookFormat,
      totalPages: patch.totalPages ?? source.totalPages,
      currentPage: patch.currentPage ?? source.currentPage,
      tags: normalizeTags(patch.tags ?? source.tags),
      status: (patch.status ?? source.status) as BookStatus,
    };

    const validationErrors = validateBookDraft(merged, { allowCompletedStatus: true });
    if (Object.keys(validationErrors).length > 0) {
      throw new RepositoryValidationError(firstValidationMessage(validationErrors));
    }

    let status = merged.status;
    if (merged.currentPage >= merged.totalPages) {
      status = "completed";
    }

    if (status === "completed" && merged.currentPage < merged.totalPages) {
      throw new RepositoryValidationError(
        "完読にするには到達ページを総ページ以上にしてください。"
      );
    }

    const updated = await prisma.bookRecordBook.update({
      where: { id: bookId },
      data: {
        title: merged.title.trim(),
        author: merged.author.trim(),
        genre: merged.genre?.trim() ? merged.genre.trim() : null,
        format: merged.format as BookRecordBook["format"],
        totalPages: merged.totalPages,
        currentPage: merged.currentPage,
        tags: merged.tags,
        status: status as BookRecordBook["status"],
        completedAt: status === "completed" ? source.completedAt ?? new Date() : null,
      },
      include: {
        reflection: true,
      },
    });

    if (patch.reflection) {
      const reflectionErrors = validateReflection(patch.reflection);
      if (Object.keys(reflectionErrors).length > 0) {
        throw new RepositoryValidationError(firstValidationMessage(reflectionErrors));
      }

      await prisma.bookRecordReflection.upsert({
        where: {
          bookId,
        },
        create: {
          bookId,
          learning: patch.reflection.learning,
          action: patch.reflection.action,
          quote: patch.reflection.quote,
          createdAt: new Date(),
        },
        update: {
          learning: patch.reflection.learning,
          action: patch.reflection.action,
          quote: patch.reflection.quote,
        },
      });
    }

    if (!patch.reflection) {
      return toBook(updated);
    }

    const refreshed = await prisma.bookRecordBook.findUnique({
      where: { id: bookId },
      include: {
        reflection: true,
      },
    });

    if (!refreshed) {
      throw new RepositoryNotFoundError("対象の書籍が見つかりません。");
    }

    return toBook(refreshed);
  }

  async addProgressLog(
    bookId: string,
    input: CreateProgressLogInput
  ): Promise<{ book: Book; log: ProgressLog }> {
    const source = await prisma.bookRecordBook.findUnique({
      where: { id: bookId },
      include: {
        reflection: true,
      },
    });

    if (!source) {
      throw new RepositoryNotFoundError("対象の書籍が見つかりません。");
    }

    const validationErrors = validateProgressDraft({
      page: input.page,
      totalPages: source.totalPages,
      status: input.status,
      memo: input.memo ?? "",
    });
    if (Object.keys(validationErrors).length > 0) {
      throw new RepositoryValidationError(firstValidationMessage(validationErrors));
    }

    let status: BookStatus = input.status;
    if (input.page >= source.totalPages) {
      status = "completed";
    }

    if (status === "completed" && input.page < source.totalPages) {
      throw new RepositoryValidationError(
        "完読にするには到達ページを総ページ以上にしてください。"
      );
    }

    const loggedAt = parseLoggedAt(input.loggedAt);
    const completedAt = status === "completed" ? source.completedAt ?? loggedAt : null;

    const [book, log] = await prisma.$transaction([
      prisma.bookRecordBook.update({
        where: { id: bookId },
        data: {
          currentPage: input.page,
          status: status as BookRecordBook["status"],
          completedAt,
        },
        include: {
          reflection: true,
        },
      }),
      prisma.bookRecordProgressLog.create({
        data: {
          bookId,
          page: input.page,
          memo: input.memo?.trim() || null,
          status: status as BookRecordBook["status"],
          loggedAt,
        },
      }),
    ]);

    return {
      book: toBook(book),
      log: toProgressLog(log),
    };
  }

  async saveReflection(bookId: string, input: ReflectionInput): Promise<Book> {
    const source = await prisma.bookRecordBook.findUnique({
      where: { id: bookId },
      include: {
        reflection: true,
      },
    });

    if (!source) {
      throw new RepositoryNotFoundError("対象の書籍が見つかりません。");
    }

    const validationErrors = validateReflection(input);
    if (Object.keys(validationErrors).length > 0) {
      throw new RepositoryValidationError(firstValidationMessage(validationErrors));
    }

    await prisma.$transaction([
      prisma.bookRecordReflection.upsert({
        where: {
          bookId,
        },
        create: {
          bookId,
          learning: input.learning,
          action: input.action,
          quote: input.quote,
          createdAt: source.reflection?.createdAt ?? new Date(),
        },
        update: {
          learning: input.learning,
          action: input.action,
          quote: input.quote,
        },
      }),
      prisma.bookRecordBook.update({
        where: { id: bookId },
        data: {
          updatedAt: new Date(),
        },
      }),
    ]);

    const updated = await prisma.bookRecordBook.findUnique({
      where: {
        id: bookId,
      },
      include: {
        reflection: true,
      },
    });

    if (!updated) {
      throw new RepositoryNotFoundError("対象の書籍が見つかりません。");
    }

    return toBook(updated);
  }

  async searchBooks(query: string): Promise<Book[]> {
    const normalized = query.trim().toLocaleLowerCase();
    const books = await this.listBooks();

    if (!normalized) {
      return books;
    }

    return books.filter((book) => {
      const target = [book.title, book.author, ...(book.tags ?? [])].join(" ").toLocaleLowerCase();
      return target.includes(normalized);
    });
  }
}
