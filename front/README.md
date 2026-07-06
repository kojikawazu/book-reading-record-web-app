# Frontend App (`front/`)

Next.js 16 + TypeScript + Tailwind CSS で実装した読書記録MVPフロントエンドです。

## Requirements

- Node.js 20+
- pnpm 10+

## Setup

### 1. 依存インストール

```bash
pnpm install
```

### 2-A. `local` モードで動かす（Supabase 不要・推奨の最短経路）

```bash
NEXT_PUBLIC_REPOSITORY_DRIVER=local pnpm dev
```

環境変数が未設定でも `local` にフォールバックするため、`pnpm dev` のみでも `local` で起動します。データはブラウザの localStorage に保存されます。

### 2-B. `supabase` モードで動かす（通常運用）

```bash
cp .env.example .env.local
# .env.local を開き、各値を実際の Supabase プロジェクトの値に置き換える
pnpm dev
```

> ⚠️ `.env.example` は `NEXT_PUBLIC_REPOSITORY_DRIVER="supabase"` ＋ プレースホルダ値です。
> **コピーしただけ（プレースホルダのまま）では `supabase` モードに切り替わって認証エラーになり、更新操作ができません。**
> 実際の `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 等を必ず設定してください。

### 3. E2E を実行する場合のみ

```bash
pnpm test:e2e:install   # Playwright（Chromium）を取得
```

### 4. IT（結合テスト）を実行する場合のみ

IT は使い捨て Postgres コンテナ（`docker-compose.test.yml`・`localhost:5433`）に対して実行します。**Docker が必要**です。共有 Supabase には一切接続しません。

```bash
pnpm test:it        # コンテナ起動(--wait) → prisma db push → Vitest(node) 実行
pnpm test:it:down   # テスト DB コンテナを破棄
```

> 接続先は `vitest.it.config.ts` の既定値（`localhost:5433`）を使うため、`.env.test` は無くても動きます（ローカル上書き用に `.env.test` を置くことも可能）。

## Environment Variables

`NEXT_PUBLIC_REPOSITORY_DRIVER` が未設定の場合、Supabase の URL/キーが揃っていれば `supabase`、なければ `local` を自動選択します（`src/lib/repository-instance.ts`）。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`（任意、利用時のみ）
- `NEXT_PUBLIC_REPOSITORY_DRIVER`（`supabase` or `local`）
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（サーバー用途のみ）

実値は `.env.local` に設定し、`.env.example` は共有テンプレートとして管理します。
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` はこのリポジトリでは使用しません（Supabase Authプロジェクト側で管理）。

## Supabase Auth（Google OAuth）設定

1. Supabase Authプロジェクト側で `Auth > Providers > Google` が有効化済みであることを確認する
2. `Auth > URL Configuration` で Redirect URL に以下を追加する
   - `http://localhost:3000/auth/login`
   - 本番URLを使う場合は同様に `/auth/login` を追加する
3. `NEXT_PUBLIC_REPOSITORY_DRIVER=supabase` で起動し、`/auth/login` からログインする
4. 認可ポリシー
   - 閲覧系（`/` と `/stats`）は未ログインでも閲覧可能
   - 更新系（書籍登録・進捗記録・感想保存・再読）はログイン必須

## Supabase + Prisma運用（チームルール）

1. このリポジトリでは、既存Supabaseプロジェクトのテーブル定義を `Prisma db pull` で同期する
2. テーブル定義の反映（push）は別プロジェクト側で実施してもらう
3. 別プロジェクトで反映完了後、このリポジトリで再度 `Prisma db pull` を実行する
4. このリポジトリから `Prisma db push` / `Prisma migrate` は実行しない
5. このプロジェクト用の物理テーブル名は `BookRecord` 接頭辞を付与する

## Scripts

- `pnpm dev`: 開発サーバー起動
- `pnpm build`: 本番ビルド
- `pnpm start`: 本番モード起動
- `pnpm lint`: ESLint
- `pnpm lint:fix`: ESLint自動修正
- `pnpm format`: Prettier整形
- `pnpm format:check`: Prettierチェック
- `pnpm prisma:validate`: `.env.local` を読み込んでPrismaスキーマ検証
- `pnpm prisma:pull`: `.env.local` を読み込んでSupabase定義をpull
- `pnpm prisma:generate`: `.env.local` を読み込んでPrisma Client生成
- `pnpm test`: Vitest UT（単体・jsdom・外部 I/O モック）
- `pnpm test:it`: Vitest IT（結合・node・DB コンテナを起動して実 Postgres で実行）
- `pnpm test:it:down`: IT 用テスト DB コンテナの破棄
- `pnpm test:e2e`: Playwright E2E実行
- `pnpm test:e2e:ui`: Playwright UIモード
- `pnpm test:e2e:headed`: Headed実行

## Vercel Build Skip Rule

- `front/vercel.json` の `ignoreCommand` で、`docs/` のみ変更されたコミットはVercelビルドをスキップする
- `front/` 配下やその他ファイルの変更がある場合は通常どおりビルドする

## Routes

- `/`: ダッシュボード
- `/auth/login`: Googleログイン
- `/books/new`: 書籍登録
- `/books/[id]`: 書籍詳細・進捗記録
- `/stats`: 統計レポート

## Data Persistence

- `NEXT_PUBLIC_REPOSITORY_DRIVER=supabase` の場合:
  - Prisma経由のSupabase DB（`BookRecord*` テーブル）を利用
- `NEXT_PUBLIC_REPOSITORY_DRIVER=local` の場合:
  - localStorage key: `book-reading-record.v1`
