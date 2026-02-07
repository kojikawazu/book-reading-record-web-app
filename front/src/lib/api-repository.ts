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

type ApiError = {
  message?: string;
};

class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

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

export class ApiRepository implements BookRepository {
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
