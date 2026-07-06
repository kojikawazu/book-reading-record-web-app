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

// Prisma の Reflection 行をドメインの Reflection へ変換する（日時は ISO 文字列化）。
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

// Prisma の Book 行（reflection を include したもの）をドメインの Book へ変換する。
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

// Prisma の ProgressLog 行をドメインの ProgressLog へ変換する。
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

/**
 * 書籍ドラフトをサーバー側で検証する（クライアント検証を信用せず二重に守る）。
 *
 * @param input - 検証対象のドラフト
 * @param options - 検証オプション
 * @param options.allowCompletedStatus - false で初期ステータスの completed を禁止する
 * @returns フィールド別エラー（問題なければ空オブジェクト）
 */
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

/**
 * 記録日時文字列を Date へ変換する。未指定なら現在時刻、パース不能なら検証エラーにする。
 *
 * @param loggedAt - ISO 日時文字列または undefined
 * @returns 変換した Date
 * @throws {RepositoryValidationError} 日時としてパースできない場合
 */
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

/** 入力検証違反（HTTP 400 相当）。 */
export class RepositoryValidationError extends Error {
  readonly statusCode = 400;
}

/** 対象データ未検出（HTTP 404 相当）。 */
export class RepositoryNotFoundError extends Error {
  readonly statusCode = 404;
}

/**
 * 値が Repository 由来のエラー（400/404）かどうかを判定する型ガード。
 * Route Handler が statusCode をそのまま HTTP ステータスへ写すために使う。
 *
 * @param value - 判定対象の値
 * @returns Repository エラーなら true
 */
export const isRepositoryError = (
  value: unknown
): value is RepositoryValidationError | RepositoryNotFoundError => {
  return value instanceof RepositoryValidationError || value instanceof RepositoryNotFoundError;
};

/**
 * Supabase PostgreSQL を Prisma で操作する BookRepository 実装（`supabase` モードのサーバー側）。
 * 並び順・完読判定・感想の上書きなどの業務ルールは LocalStorageRepository と論理的に一致させる。
 */
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

  /**
   * 書籍を部分更新する。完読条件を満たせば completed を強制し、感想が渡された場合のみ
   * Reflection を upsert する。感想更新後は最新の reflection を含めて返すため再取得する。
   *
   * @param bookId - 対象書籍の ID
   * @param patch - 更新するフィールド（reflection を含みうる）
   * @returns 更新後の書籍
   * @throws {RepositoryNotFoundError} 書籍が存在しない場合
   * @throws {RepositoryValidationError} 入力不正・完読条件未達で completed の場合
   */
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
      throw new RepositoryValidationError("完読にするには到達ページを総ページ以上にしてください。");
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
        completedAt: status === "completed" ? (source.completedAt ?? new Date()) : null,
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

    // 感想を更新していないなら upsert 前の結果で足りる。更新した場合のみ再取得して整合させる。
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
      throw new RepositoryValidationError("完読にするには到達ページを総ページ以上にしてください。");
    }

    const loggedAt = parseLoggedAt(input.loggedAt);
    const completedAt = status === "completed" ? (source.completedAt ?? loggedAt) : null;

    // 書籍更新と進捗ログ追加は 1 トランザクションで確定し、片方だけ反映される不整合を防ぐ。
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
          // 初回作成時のみ採番し、上書き時は元の作成日時を維持する。
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
