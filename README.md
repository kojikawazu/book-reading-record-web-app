# Book Reading Record Web App

読書記録（ページ進捗・完読感想・再読）を管理する単一ユーザー向けMVPです。

## Repository Structure

- `base/`: 参照用の既存MVP（read-only）
- `front/`: 実装本体（Next.js / TypeScript / Tailwind CSS）
- `docs/`: 要件・仕様・E2Eケース

## MVP Features

- 書籍登録（タイトル/著者/形式/総ページ/初期ステータス）
- ページ進捗入力（絶対値）+ メモ + ステータス更新
- 完読時感想（学び/行動/一文、空入力可）
- 再読（完読 -> 読書中、`currentPage=0`）
- ダッシュボード（読書前/読書中/保留/完読/感想未記入）
- 検索（タイトル・著者・タグ）
- 週次サマリー（読了ページ/進捗回数/感想数）
- 統計レポート (`/stats`)

## Local Development

```bash
cd front
pnpm install
pnpm test:e2e:install
pnpm dev
```

Open: `http://localhost:3000`

## Quality Checks

```bash
cd front
pnpm format:check
pnpm lint
pnpm build
pnpm test:e2e
```

## Notes

- データ保存先は `NEXT_PUBLIC_REPOSITORY_DRIVER` で切り替える（`supabase` / `local`）
- 通常運用は `supabase`、E2E受け入れは `local` を使用する
- E2E は Playwright（Chromium）
- 仕様優先順位は `docs/04.e2e-cases.md > docs/03.requirements.md > docs/02.ui-layout.md`
