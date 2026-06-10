# API 仕様書（API Specification）

`supabase` / `local` 両モードで共通利用するデータアクセス契約（Repository インターフェース）と、`supabase` モードの HTTP エンドポイント仕様を定義する。

- 認証方式・RLS の詳細は `docs/06-security-specification.md` を参照する。
- アーキテクチャ・環境変数・Prisma 同期フローは `docs/09-architecture-specification.md` を参照する。

## 目次

- [1. 目的](#1-目的)
- [2. 必須 Repository インターフェース](#2-必須-repository-インターフェース)
- [3. エラー契約](#3-エラー契約)
- [4. HTTP エンドポイント（`supabase` モード）](#4-http-エンドポイントsupabase-モード)

## 1. 目的
- `supabase` / `local` の両モードで共通利用するデータアクセス契約を定義する

## 2. 必須 Repository インターフェース
- `listBooks(): Promise<Book[]>`
- `getBook(bookId: string): Promise<Book | null>`
- `listProgressLogs(bookId: string): Promise<ProgressLog[]>`
- `createBook(input: CreateBookInput): Promise<Book>`
- `updateBook(bookId: string, patch: UpdateBookInput): Promise<Book>`
- `addProgressLog(bookId: string, input: CreateProgressLogInput): Promise<{ book: Book; log: ProgressLog }>`
- `saveReflection(bookId: string, input: ReflectionInput): Promise<Book>`
- `searchBooks(query: string): Promise<Book[]>`

データ型定義は `docs/05-data-specification.md` を参照する。

## 3. エラー契約
- バリデーション違反は業務エラーとして扱い、画面に表示可能なメッセージを返す
- `local` モードでデータ破損時は復旧処理を優先し、アプリ全体をクラッシュさせない
- HTTP エラーは `{ message }` 形式の JSON で返す（例: `400` 不正リクエスト、`401` 未認証、`404` 未検出、`500` 内部エラー）

## 4. HTTP エンドポイント（`supabase` モード）

クライアント `ApiRepository` は `/api/book-record/*` を呼び出し、Next.js Route Handler が `PrismaBookRecordRepository` に委譲する。

| メソッド・パス | 用途 | 認可 |
| --- | --- | --- |
| `GET /api/book-record/books` | 書籍一覧取得 | 未認証可 |
| `POST /api/book-record/books` | 書籍作成 | Bearer 必須 |
| `GET /api/book-record/books/[id]` | 書籍取得 | 未認証可 |
| `PATCH /api/book-record/books/[id]` | 書籍更新（再読含む） | Bearer 必須 |
| `GET /api/book-record/books/[id]/progress-logs` | 進捗履歴取得 | 未認証可 |
| `POST /api/book-record/books/[id]/progress-logs` | 進捗記録追加 | Bearer 必須 |
| `POST /api/book-record/books/[id]/reflection` | 感想保存 | Bearer 必須 |

- 更新系（`POST` / `PATCH`）は `Authorization: Bearer <token>` が必須。未認証は `401` を返す。
- 認証ガードの実体・トークン検証は `docs/06-security-specification.md` §6 を参照する。
