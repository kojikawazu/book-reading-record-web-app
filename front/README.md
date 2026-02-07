# Frontend App (`front/`)

Next.js 16 + TypeScript + Tailwind CSS で実装した読書記録MVPフロントエンドです。

## Requirements

- Node.js 20+
- pnpm 10+

## Setup

```bash
pnpm install
pnpm test:e2e:install
```

必要に応じて環境変数ファイルを作成します。

```bash
cp .env.example .env.local
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_REPOSITORY_DRIVER`（`supabase` or `local`）
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`（サーバー用途のみ）

実値は `.env.local` に設定し、`.env.example` は共有テンプレートとして管理します。

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
- `pnpm test:e2e`: Playwright E2E実行
- `pnpm test:e2e:ui`: Playwright UIモード
- `pnpm test:e2e:headed`: Headed実行

## Routes

- `/`: ダッシュボード
- `/books/new`: 書籍登録
- `/books/[id]`: 書籍詳細・進捗記録
- `/stats`: 統計レポート

## Data Persistence

- `NEXT_PUBLIC_REPOSITORY_DRIVER=supabase` の場合:
  - Prisma経由のSupabase DB（`BookRecord*` テーブル）を利用
- `NEXT_PUBLIC_REPOSITORY_DRIVER=local` の場合:
  - localStorage key: `book-reading-record.v1`
