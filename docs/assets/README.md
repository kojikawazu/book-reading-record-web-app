# docs/assets

README で参照するスクリーンショット等の画像を格納する。

## ファイル

| ファイル | 内容 |
|---|---|
| `dashboard.png` | ダッシュボード（`/`） |
| `stats.png` | 統計レポート（`/stats`） |
| `book-detail.png` | 書籍詳細・進捗（`/books/[id]`） |

## 再生成

サンプルデータをシードして自動撮影する。

```bash
cd front
pnpm install
pnpm test:e2e:install                      # 初回のみ（Playwright Chromium）

# 1) local モードで開発サーバーを起動
NEXT_PUBLIC_REPOSITORY_DRIVER=local pnpm dev

# 2) 別ターミナルで撮影
pnpm screenshots
```

- 撮影スクリプト: `front/scripts/capture-screenshots.mjs`
- シードデータ（書籍4冊・進捗ログ・感想）はスクリプト内に定義。実データには影響しない（`local` モードの localStorage のみ使用）。
- 別ポートで起動している場合は `SCREENSHOT_BASE_URL=http://localhost:3001 pnpm screenshots`。
