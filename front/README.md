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

## Scripts

- `pnpm dev`: 開発サーバー起動
- `pnpm build`: 本番ビルド
- `pnpm start`: 本番モード起動
- `pnpm lint`: ESLint
- `pnpm lint:fix`: ESLint自動修正
- `pnpm format`: Prettier整形
- `pnpm format:check`: Prettierチェック
- `pnpm test:e2e`: Playwright E2E実行
- `pnpm test:e2e:ui`: Playwright UIモード
- `pnpm test:e2e:headed`: Headed実行

## Routes

- `/`: ダッシュボード
- `/books/new`: 書籍登録
- `/books/[id]`: 書籍詳細・進捗記録
- `/stats`: 統計レポート

## Data Persistence

- localStorage key: `book-reading-record.v1`
