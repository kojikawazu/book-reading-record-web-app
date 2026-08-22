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

## テストファイルの配置（集約する）

**テストは専用ディレクトリに集約し、`src/` にコロケートしない。**

```text
front/
├── e2e/                    # E2E（Playwright）。playwright.config.ts の testDir
├── tests/
│   ├── ut/                 # UT。src/ の構造をミラーする
│   ├── it/                 # IT（*.it.test.ts）
│   └── support/            # テスト足場（globalSetup・ハーネス・スタブ）
└── src/                    # 本番コードのみ。テストファイルを置かない
```

- **`tests/ut/` と `tests/it/` は `src/` のディレクトリ構造をミラーする**（例: `src/lib/helpers.ts` → `tests/ut/lib/helpers.test.ts`）。対応関係を機械的に辿れるようにするため。
- **UT と IT はディレクトリで分ける**。実行構成・実行環境（jsdom / node）・所要時間が異なり、`include` パターンで確実に分離する必要があるため。IT のファイル名は `*.it.test.ts` を維持する。
- **テスト足場は `tests/support/` に置く**。`src/` にテスト専用コードを残さない。
- **import は `@/`（`src/`）と `@tests/`（`tests/`）のパスエイリアスを使う**。集約により相対パスが深くなるため、テストでも相対 import をしない（`frontend.md`「インポート」）。
- E2E は Playwright の慣習に従い `front/e2e/` に置く（`tests/` 配下に移動しない）。

**なぜ集約するか**: `src/` を本番コードだけにすると、ビルド対象・カバレッジ対象・レビュー対象の境界がディレクトリと一致する。コロケーションは対象ファイルの近さと引き換えに、この境界を曖昧にする。

## モック方針

- **モックは外部 I/O 境界のみ**（`fetch` / `localStorage` / Supabase クライアント / Prisma）。ビジネスロジック（`validate*` / `computeWeeklySummary` / 並び順 / 完読判定等）はモックしない。
- **UT**: 外部 I/O をモックして高速・隔離実行する。準正常・異常系（バリデーション・パース失敗・HTTP エラー）を厚くする主戦場。
- **IT / E2E**: モックせず **DB コンテナ（実 Postgres）** に対して検証する。`supabase` の共有 DB は使わない。

## DB コンテナ

- IT・E2E(supabase レーン) は `docker-compose.test.yml` の使い捨て Postgres を使う。共有 Supabase プロジェクトには一切接続しない。
- スキーマ投入は**テストコンテナ限定で `prisma db push`**（`.claude/rules/database.md` の例外規定を参照）。
- E2E(supabase レーン)の認証は、本番で無効な env ゲート付きテストシームで通す（`docs/06-security-specification.md` 参照）。

## テスト用 DB の接続先（破壊防止）

**テストは本番と同じ接続先環境変数（`DATABASE_URL`）を参照してはならない。** IT / E2E は既存データを全削除する前提（`TRUNCATE` / `deleteMany` / `db push --accept-data-loss`）で書かれるため、接続先を誤ると本番データが消える。前節「DB コンテナ」が**どこに繋ぐか**を定めるのに対し、本節はそれを**どう強制するか**を定める。

- 接続先の解決は **1 箇所に集約**する（`front/tests/support/test-database-url.ts`）。IT・E2E の双方がこの入口を通す。
- 上書きは**テスト専用の環境変数**（`TEST_DATABASE_URL`）でのみ行う。既定値は `postgresql://postgres:postgres@localhost:5433/book_record_test?schema=public`。
- **ホストの allowlist で検証し、`localhost` / `127.0.0.1` / `::1` 以外なら接続前に throw する。** テストランナー起動時ではなく、**seed・migrate・`TRUNCATE` が走る前**に落とす。globalSetup だけに置くと、ワーカープロセスで走る破壊的操作を守れない。
- 検証を通った値のみを `DATABASE_URL` へ**注入**する。Prisma Client / Prisma CLI は `DATABASE_URL` しか見ないため、**汚染された値を残さず必ず上書きする**形にする（読み取って分岐するのではなく、上書きして塞ぐ）。
- 失敗メッセージには**解決されたホスト名**と**復旧手順**（テスト DB の起動コマンド `docker compose -f docker-compose.test.yml up -d --wait`、既定 URL）を含める。原因の特定に時間をかけさせない。
- **`process.env.X ?? ローカル既定` というフォールバックを書かない。** 「未設定なら安全側」に見えて、実際は「**値が入っていれば危険側**」に倒れる。安全な既定は allowlist（通すものを列挙し、他は落とす）である。
- ガード自体をテストする（既定値・`localhost` / `127.0.0.1` / `::1` の許可・`DATABASE_URL` が本番で汚染されていても無視すること・リモート拒否・メッセージ内容）。

**なぜフォールバックが危険か**: ORM クライアント（Prisma 等）を import した時点で `.env` が `process.env` に読み込まれる実装がある。この場合 `process.env.DATABASE_URL ?? ローカル既定` は **`.env` の本番 URL を拾う**。しかもアプリ側と seed 側で評価タイミングが違うと、**アプリはローカルを読み、seed だけが本番を壊す**という非対称が起き、症状は「seed 依存テストが全滅」という形でしか現れない。

> **テストが不可解に全滅したら、まず接続先を疑う。** 原因を推測で決めつけて環境変数を手で固定し、先に進めてはならない。

同じ原則は DB 以外の破壊的操作にも適用する。テストやスクリプトが外部リソース（ストレージ、キュー、メール送信、決済 API 等）を消去・送信し得る場合は、接続先・宛先を allowlist で検証し、本番を指したら実行前に失敗させる。

**テスト以外も含めた本番操作全般**（手元からの実行・MCP・管理コンソール）は `production-data.md` を参照する。
