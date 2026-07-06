import { BookRepository } from "./repository";
import {
  Book,
  CreateBookInput,
  CreateProgressLogInput,
  ProgressLog,
  ReflectionInput,
  UpdateBookInput,
} from "./types";
import { getSupabaseBrowserClient, isSupabaseAuthConfigured } from "./supabase/client";

/** API エラーレスポンスの想定形（`{ message }`）。 */
type ApiError = {
  message?: string;
};

/** HTTP ステータスコードを保持するエラー。404 の分岐など、ステータスで振る舞いを変えるために使う。 */
class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * エラーレスポンスから表示用メッセージを取り出す。JSON でない・message 欠落時は既定文言にフォールバックする。
 *
 * @param response - 失敗した fetch レスポンス
 * @returns 画面表示に使えるエラーメッセージ
 */
const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as ApiError;
    if (typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }
  } catch {
    // no-op
  }

  return "データ操作に失敗しました。";
};

/**
 * `/api/book-record/*` を呼び出す BookRepository 実装（`supabase` モード）。
 * サーバー側の PrismaBookRecordRepository に委譲する薄いクライアント。
 */
export class ApiRepository implements BookRepository {
  /**
   * 共通 fetch ラッパー。Supabase セッションがあれば Bearer トークンを付与し、
   * 非 2xx は HttpError に変換して投げる。
   *
   * @param path - リクエスト先パス
   * @param init - 追加の fetch オプション
   * @returns パース済みレスポンスボディ
   * @throws {HttpError} レスポンスが非 2xx の場合
   */
  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!isSupabaseAuthConfigured) {
      throw new Error("Supabase Authの環境変数が不足しています。");
    }

    const supabase = getSupabaseBrowserClient();
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error) {
      throw new Error("ログインセッションの取得に失敗しました。");
    }

    const accessToken = sessionResult.data.session?.access_token;

    const headers = new Headers(init?.headers);
    headers.set("content-type", "application/json");
    // 更新系は Bearer が必須。閲覧系は未ログインでも通るため、トークンがある場合のみ付与する。
    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(path, {
      ...init,
      headers,
    });

    if (!response.ok) {
      throw new HttpError(await readErrorMessage(response), response.status);
    }

    return (await response.json()) as T;
  }

  async listBooks(): Promise<Book[]> {
    const data = await this.request<{ books: Book[] }>("/api/book-record/books");
    return data.books;
  }

  /**
   * 書籍を1冊取得する。404 は「未検出」として null に変換し、それ以外のエラーは再送出する。
   *
   * @param bookId - 対象書籍の ID
   * @returns 書籍。存在しなければ null
   */
  async getBook(bookId: string): Promise<Book | null> {
    try {
      const data = await this.request<{ book: Book }>(`/api/book-record/books/${bookId}`);
      return data.book;
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async listProgressLogs(bookId: string): Promise<ProgressLog[]> {
    const data = await this.request<{ logs: ProgressLog[] }>(
      `/api/book-record/books/${bookId}/progress-logs`
    );
    return data.logs;
  }

  async createBook(input: CreateBookInput): Promise<Book> {
    const data = await this.request<{ book: Book }>("/api/book-record/books", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        // サーバーは genre を string として検証するため、未指定は空文字で送る。
        genre: input.genre ?? "",
      }),
    });

    return data.book;
  }

  async updateBook(bookId: string, patch: UpdateBookInput): Promise<Book> {
    const data = await this.request<{ book: Book }>(`/api/book-record/books/${bookId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });

    return data.book;
  }

  async addProgressLog(
    bookId: string,
    input: CreateProgressLogInput
  ): Promise<{ book: Book; log: ProgressLog }> {
    return this.request<{ book: Book; log: ProgressLog }>(
      `/api/book-record/books/${bookId}/progress-logs`,
      {
        method: "POST",
        body: JSON.stringify({
          page: input.page,
          memo: input.memo ?? "",
          status: input.status,
          loggedAt: input.loggedAt,
        }),
      }
    );
  }

  async saveReflection(bookId: string, input: ReflectionInput): Promise<Book> {
    const data = await this.request<{ book: Book }>(`/api/book-record/books/${bookId}/reflection`, {
      method: "POST",
      body: JSON.stringify(input),
    });

    return data.book;
  }

  /**
   * 一覧を取得してクライアント側で部分一致フィルタする（検索専用 API は持たない）。
   *
   * @param query - 検索キーワード（空なら全件）
   * @returns 一致した書籍配列
   */
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
