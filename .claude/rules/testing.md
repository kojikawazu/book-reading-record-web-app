---
description: テスト分類・原則（スタック非依存）
globs: 
---

# テストルール

## テスト分類

| 分類 | 定義 |
|------|------|
| 正常系（Normal） | 期待通りの入力 → 正しい結果 |
| 準正常系（Semi-Normal） | 想定内の異常入力 → 適切なハンドリング |
| 異常系（Abnormal） | 想定外のエラー → 安全な失敗 |

## 原則

- テストは仕様の証明。テストが失敗したら実装を修正する（テストを実装に合わせない）。
- 正常系 1 : 異常系（準正常系 + 異常系）2 以上の比率を目安とする。
- ビジネスロジックをモックしない。モックは外部 I/O（HTTP通信、DB接続、ファイルシステム）のみ。
- `toBeTruthy()` 等の曖昧なアサーションを避け、具体的な値で検証する。

## テストツール

> 本プロジェクトは **E2E（Playwright）のみ**。単体テストは追加しない（`docs/01-business-requirements.md` §6 禁止事項）。

| テスト種別 | ツール |
|-----------|--------|
| E2E テスト | Playwright（Chromium・`local` モード / `front/e2e/`） |
| スモークテスト | Playwright（起動確認・主要ページ表示） |

- 受け入れ基準は `docs/08-test-specification.md` の受け入れ E2E ケース（Case 1-18）を正とする。
- 実行: `cd front && pnpm test:e2e`（webServer は `NEXT_PUBLIC_REPOSITORY_DRIVER=local` で起動）。
- セレクタは `data-testid` を優先し、文言ベース取得は補助的に用いる。
