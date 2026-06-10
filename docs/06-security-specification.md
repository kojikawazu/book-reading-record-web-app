# セキュリティ仕様書（Security Specification）

入力検証、認証・認可、RLS、XSS 対策、秘密情報管理を定義する。エンドポイント別の認可一覧は `docs/07-api-specification.md` を参照する。

## 目次

- [1. 目的](#1-目的)
- [2. 入力検証](#2-入力検証)
- [3. 状態整合性](#3-状態整合性)
- [4. XSS / 安全な表示](#4-xss--安全な表示)
- [5. 秘密情報管理](#5-秘密情報管理)
- [6. 認証契約（Supabase Auth）](#6-認証契約supabase-auth)
- [7. RLSポリシー（Row Level Security）](#7-rlsポリシーrow-level-security)
  - [7.1 方針](#71-方針)
  - [7.2 ポリシー定義](#72-ポリシー定義)
  - [7.3 適用日](#73-適用日)
- [8. 将来拡張（Phase 2）](#8-将来拡張phase-2)

## 1. 目的
- 入力検証とフロント実装のセキュリティ要件、認証・認可方式を定義する

## 2. 入力検証
- `title`: 必須、1-200文字
- `author`: 必須、1-120文字
- `genre`: 任意、0-80文字
- `totalPages`: 必須、1-100000 の整数
- `currentPage`: 0-100000 の整数（書籍登録時は `0` を自動設定）
- `memo`: 任意、0-5000文字
- `learning`: 任意、0-5000文字
- `action`: 任意、0-5000文字
- `quote`: 任意、0-5000文字
- `tags`: 任意、最大10件、各1-30文字

## 3. 状態整合性
- `currentPage >= totalPages` の場合、保存時に `status=completed` を強制する
- `currentPage < totalPages` かつ `status=completed` は保存エラー
- 再読開始時は `currentPage=0` とする

## 4. XSS / 安全な表示
- `dangerouslySetInnerHTML` を使用しない
- ユーザー入力をHTMLとして解釈しない（Reactの標準エスケープを前提）
- 外部リンクを開く場合は `rel="noopener noreferrer"` を付与する

## 5. 秘密情報管理
- `.env.local` を利用し、秘密情報をリポジトリにコミットしない
- Phase 2（Supabase接続時）は `service_role` キーをクライアントに露出しない

## 6. 認証契約（Supabase Auth）
- ログイン方式は Supabase Auth の Google OAuth を利用する
- クライアントは `ApiRepository` から `/api/book-record/*` を呼び出す際、Supabaseセッションが存在する場合のみ `Authorization: Bearer <token>` を送信する
- 閲覧系GET（`GET /api/book-record/books` / `GET /api/book-record/books/[id]` / `GET /api/book-record/books/[id]/progress-logs`）は未認証でも利用できる
- 更新系（`POST /api/book-record/books` / `PATCH /api/book-record/books/[id]` / `POST /api/book-record/books/[id]/progress-logs` / `POST /api/book-record/books/[id]/reflection`）はBearerトークン必須で、未認証は `401` を返す
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` はこのリポジトリの `.env.local` では管理しない（Supabase Authプロジェクト側で管理する）

## 7. RLSポリシー（Row Level Security）

### 7.1 方針
- `BookRecord*` テーブルはすべて RLS を有効にする
- Prisma（`DATABASE_URL` 接続）はDBオーナーロールのため RLS をバイパスする
- RLSポリシーは防御の深度（Defense-in-depth）として設定し、Supabase クライアント（`anon` / `authenticated` ロール）からの直接アクセスを制御する
- ポリシー設計はアプリケーション層の認証契約（§6）と一致させる

### 7.2 ポリシー定義

| テーブル | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `BookRecordBooks` | 誰でも可 | 認証必須 | 認証必須 | 認証必須 |
| `BookRecordProgressLogs` | 誰でも可 | 認証必須 | — | 認証必須 |
| `BookRecordReflections` | 誰でも可 | 認証必須 | 認証必須 | 認証必須 |

- SELECT（`Public read`）: `USING (true)` — 未ログインでも閲覧可能
- INSERT（`Auth write`）: `WITH CHECK (auth.uid() IS NOT NULL)` — ログイン必須
- UPDATE（`Auth update`）: `USING / WITH CHECK (auth.uid() IS NOT NULL)` — ログイン必須
- DELETE（`Auth delete`）: `USING (auth.uid() IS NOT NULL)` — ログイン必須
- `BookRecordProgressLogs` は UPDATE ポリシーなし（進捗ログは追記のみで編集不可）

### 7.3 適用日
- 2026-03-22 に全ポリシーを Supabase SQL Editor で適用済み

## 8. 将来拡張（Phase 2）
- ユーザープロフィール機能が必要になった時点で、認証方式とデータ分離方式を別途設計する
