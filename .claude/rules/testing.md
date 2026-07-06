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

## テスト層（3層構成）

> 詳細・受け入れケースは `docs/08-test-specification.md` を正とする。

| 層 | ツール | 対象 | 分離手段 |
|---|---|---|---|
| **UT（単体）** | Vitest（jsdom） | 純粋ロジック（`helpers`/`validation`）・`ApiRepository`・`LocalStorageRepository`・`auth-guard`・Route Handler・`parse*` | 外部 I/O のみモック |
| **IT（結合）** | Vitest（node・`*.it.test.ts`・直列） | Route Handler + `PrismaBookRecordRepository` → 実 Postgres | DB コンテナ（docker-compose） |
| **E2E / シナリオ** | Playwright（Chromium） | フルアプリの主要フロー | local レーン（高速） + supabase レーン（DB コンテナ・本番同等） |

- 実行: `pnpm test`（UT）/ `pnpm test:it`（IT）/ `pnpm test:e2e`（E2E）を `front/` で実行する。
- セレクタ（E2E）は `data-testid` を優先し、文言ベース取得は補助的に用いる。
- UT/IT/E2E の受け入れケースは `docs/08-test-specification.md` を正とする。

## モック方針

- **モックは外部 I/O 境界のみ**（`fetch` / `localStorage` / Supabase クライアント / Prisma）。ビジネスロジック（`validate*` / `computeWeeklySummary` / 並び順 / 完読判定等）はモックしない。
- **UT**: 外部 I/O をモックして高速・隔離実行する。準正常・異常系（バリデーション・パース失敗・HTTP エラー）を厚くする主戦場。
- **IT / E2E**: モックせず **DB コンテナ（実 Postgres）** に対して検証する。`supabase` の共有 DB は使わない。

## DB コンテナ

- IT・E2E(supabase レーン) は `docker-compose.test.yml` の使い捨て Postgres を使う。共有 Supabase プロジェクトには一切接続しない。
- スキーマ投入は**テストコンテナ限定で `prisma db push`**（`.claude/rules/database.md` の例外規定を参照）。
- E2E(supabase レーン)の認証は、本番で無効な env ゲート付きテストシームで通す（`docs/06-security-specification.md` 参照）。
