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
  - [7.3 適用と突合](#73-適用と突合)
  - [7.4 検証方法](#74-検証方法)
- [8. 将来拡張（Phase 2）](#8-将来拡張phase-2)

## 1. 目的

- 入力検証とフロント実装のセキュリティ要件、認証・認可方式を定義する

## 2. 入力検証

- `title`: 必須、1-200文字
- `author`: 必須、1-120文字
- `genre`: 任意、0-80文字
- `totalPages`: 任意、1-100000 の整数。`0` は「未入力」として許容する
- `currentPage`: 0-100000 の整数（書籍登録時は `0` を自動設定）
- `memo`: 任意、0-5000文字
- `learning`: 任意、0-5000文字
- `action`: 任意、0-5000文字
- `quote`: 任意、0-5000文字
- `tags`: 任意、最大10件、各1-30文字

## 3. 状態整合性

- `totalPages >= 1`（入力済み）の場合
  - `currentPage >= totalPages` なら保存時に `status=completed` を強制する
  - `currentPage < totalPages` かつ `status=completed` は保存エラー
- `totalPages = 0`（未入力）の場合は上記の突合を行わず、明示的な `status=completed` を許容する
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

- `BookRecordProgressLogs` は UPDATE ポリシーなし（進捗ログは追記のみで編集不可）
- ポリシー名は SELECT が `Public read`、INSERT が `Auth write`、UPDATE が `Auth update`、DELETE が `Auth delete`
- 対象ロールはすべて `public`（＝全ロール）。`anon` / `authenticated` を名指ししない

**SQL 定義は `front/prisma/rls-policies.sql` を参照する。** 上表は「誰が何をできるか」の業務上の意図を示し、`USING` / `WITH CHECK` の式は SQL ファイル側を唯一の記述箇所とする（同じ知識を 2 箇所に書かない）。

### 7.3 適用と突合

- **正は本番（共有 Supabase）側にある。** `front/prisma/rls-policies.sql` はその写しであり、このリポジトリから本番へ適用しない（`.claude/rules/database.md`・`.claude/rules/production-data.md`）
- 2026-03-22 に全ポリシーを Supabase SQL Editor で適用済み
- 2026-08-22 に `pg_policies` を参照して写しと突合し、11 ポリシーが一致することを確認した。突合用のクエリは SQL ファイルの冒頭コメントに記載する
- 写しは IT のテストコンテナへ適用され、実挙動が検証される（`docs/08-test-specification.md` §3）

### 7.4 検証方法

- **Prisma は `DATABASE_URL` で DB オーナーとして接続するため RLS をバイパスする**（§7.1）。したがって通常の IT が全件成功してもポリシーは検証されない
- IT は非オーナーロール（`rls_tester`）で接続し、`auth.uid()` の有無で挙動が変わることを確かめる（`front/tests/it/prisma/rls-policies.it.test.ts`）
- 挙動の非対称に注意する。**INSERT の `WITH CHECK` 違反はエラーになるが、UPDATE / DELETE / SELECT はポリシーで弾かれてもエラーにならず対象 0 行になる**

## 8. 将来拡張（Phase 2）

- ユーザープロフィール機能が必要になった時点で、認証方式とデータ分離方式を別途設計する
