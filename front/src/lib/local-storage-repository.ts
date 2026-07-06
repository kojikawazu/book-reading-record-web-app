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

// 現在時刻の ISO 文字列。
const nowIso = (): string => new Date().toISOString();

// JSON 経由のディープコピー。localStorage 内の参照を呼び出し側へ漏らさないための防御コピー。
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * localStorage を永続化先とする BookRepository 実装（`local` モード）。
 * すべての操作は parseStoragePayload → 変更 → persistStoragePayload の順で読み書きし、
 * 破損データは読み込み時に自動復旧される（helpers.parseStoragePayload）。
 */
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

  /**
   * 書籍を部分更新する。完読条件（現在ページ ≥ 総ページ）を満たせば status を completed に強制し、
   * 逆に条件を満たさず completed 指定なら保存エラーにする。再読（completed 以外）へ戻すと completedAt を解除する。
   *
   * @param bookId - 対象書籍の ID
   * @param patch - 更新するフィールド
   * @returns 更新後の書籍
   * @throws {Error} 書籍が存在しない、または完読条件を満たさないのに completed の場合
   */
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

    // 現在ページが総ページに到達したら完読を自動確定する（docs/03 第2部）。
    if (merged.currentPage >= merged.totalPages) {
      merged.status = "completed";
    }

    if (merged.status === "completed" && merged.currentPage < merged.totalPages) {
      throw new Error("完読にするには到達ページを総ページ以上にしてください。");
    }

    // 完読なら completedAt を維持/付与、非完読（再読等）なら解除する。
    if (merged.status === "completed") {
      merged.completedAt = merged.completedAt ?? nowIso();
    } else {
      merged.completedAt = undefined;
    }

    payload.books[index] = merged;
    persistStoragePayload(payload);

    return copy(merged);
  }

  /**
   * 進捗を1件記録し、書籍の現在ページ・ステータス・完読日時を更新する。
   * 到達ページが総ページ以上なら completed に自動確定する。
   *
   * @param bookId - 対象書籍の ID
   * @param input - 進捗記録入力
   * @returns 更新後の書籍と追加された進捗ログ
   * @throws {Error} 書籍が存在しない、または完読条件を満たさないのに completed の場合
   */
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

  /**
   * 感想を保存する。既存の感想があれば createdAt を保持したまま上書きする（再完読時の再編集）。
   *
   * @param bookId - 対象書籍の ID
   * @param input - 感想入力
   * @returns 更新後の書籍
   * @throws {Error} 書籍が存在しない、または感想入力が上限超過の場合
   */
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
    // 初回作成時のみ createdAt を採番し、上書き時は元の作成日時を維持する。
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

  /**
   * localStorage の生ペイロードをそのまま返す（E2E などで内部状態を検証する用途）。
   *
   * @returns 現在の永続化ペイロード
   */
  readRawPayload(): StoragePayload {
    return parseStoragePayload();
  }
}
