import {
  Book,
  CreateBookInput,
  CreateProgressLogInput,
  ProgressLog,
  ReflectionInput,
  UpdateBookInput,
} from "./types";

/**
 * 画面が依存するデータアクセス契約。`local`（LocalStorageRepository）/
 * `supabase`（ApiRepository）の両ドライバーがこの契約を実装し、
 * NEXT_PUBLIC_REPOSITORY_DRIVER で差し替える（docs/07-api-specification.md §2）。
 * 新しい操作を足すときは両実装を必ず更新すること。
 */
export interface BookRepository {
  /**
   * 書籍一覧を表示順（updatedAt 降順ほか）で取得する。
   *
   * @returns 整列済みの書籍配列
   */
  listBooks(): Promise<Book[]>;
  /**
   * ID で書籍を1冊取得する。
   *
   * @param bookId - 対象書籍の ID
   * @returns 書籍。存在しなければ null
   */
  getBook(bookId: string): Promise<Book | null>;
  /**
   * 書籍の進捗履歴を新しい順で取得する。
   *
   * @param bookId - 対象書籍の ID
   * @returns 整列済みの進捗ログ配列
   */
  listProgressLogs(bookId: string): Promise<ProgressLog[]>;
  /**
   * 書籍を作成する（currentPage は 0 で初期化）。
   *
   * @param input - 書籍作成入力
   * @returns 作成された書籍
   */
  createBook(input: CreateBookInput): Promise<Book>;
  /**
   * 書籍を部分更新する（再読・完読の状態変更を含む）。
   *
   * @param bookId - 対象書籍の ID
   * @param patch - 更新するフィールド
   * @returns 更新後の書籍
   */
  updateBook(bookId: string, patch: UpdateBookInput): Promise<Book>;
  /**
   * 進捗を1件記録し、書籍の現在ページ・ステータスを更新する。
   *
   * @param bookId - 対象書籍の ID
   * @param input - 進捗記録入力
   * @returns 更新後の書籍と追加された進捗ログ
   */
  addProgressLog(
    bookId: string,
    input: CreateProgressLogInput
  ): Promise<{ book: Book; log: ProgressLog }>;
  /**
   * 完読時感想を保存（新規作成 or 上書き）する。
   *
   * @param bookId - 対象書籍の ID
   * @param input - 感想入力
   * @returns 更新後の書籍
   */
  saveReflection(bookId: string, input: ReflectionInput): Promise<Book>;
  /**
   * タイトル・著者・タグの部分一致で書籍を検索する。
   *
   * @param query - 検索キーワード（空なら全件）
   * @returns 一致した書籍配列
   */
  searchBooks(query: string): Promise<Book[]>;
}
