# ドキュメント索引

Book Reading Record Web App の仕様・設計ドキュメント一覧。プロジェクト概要はリポジトリ直下の [`../README.md`](../README.md) を参照。

ドキュメントは 2 層で構成している。

- **標準仕様書（`01`〜`11`）** — 仕様の正準。`project-init` 標準構成に沿って番号順に管理し、番号順に読むと全体像をつかめる。
- **[`assets/`](./assets/)** — README で参照するスクリーンショット等の画像と、その再生成手順。

## 読み進め順（おすすめ）

`01 要求 → 02 要件 → 03 機能 → 05 データ → 06 セキュリティ → 07 API → 08 テスト → 09 アーキテクチャ`。
04・10・11 は随時参照。初めて環境構築する場合は [`09-architecture-specification.md`](./09-architecture-specification.md) の構成・環境変数・セットアップ手順から。

## 標準仕様書

| # | ドキュメント | 種別 | 概要 |
|---|---|---|---|
| 01 | [要求仕様書](./01-business-requirements.md) | 要求仕様 | プロジェクト背景・目標・スコープ・制約・禁止事項 |
| 02 | [要件仕様書](./02-requirements-specification.md) | 要件仕様 | 機能要件一覧・受け入れ条件・優先順位・仕様マップ |
| 03 | [機能仕様書](./03-functional-specification.md) | 機能仕様 | 画面・UI/UX（第1部）＋ 状態遷移・集計・並び順（第2部 業務ルール） |
| 04 | [非機能仕様書](./04-non-functional-specification.md) | 非機能仕様 | 性能・ユーザビリティ・信頼性・移植性 |
| 05 | [データ仕様書](./05-data-specification.md) | データ仕様 | データモデル・ER 図・永続化・破損復旧・DB スキーマ |
| 06 | [セキュリティ仕様書](./06-security-specification.md) | セキュリティ | 入力検証・認証契約・RLS・XSS・秘密情報 |
| 07 | [API 仕様書](./07-api-specification.md) | API 仕様 | Repository I/F・エラー契約・HTTP エンドポイント |
| 08 | [テスト仕様書](./08-test-specification.md) | テスト仕様 | 実行条件・受け入れ E2E（Case 1-18）・追加 E2E 設計 |
| 09 | [アーキテクチャ仕様書](./09-architecture-specification.md) | アーキテクチャ | 構成図・技術スタック・環境変数・Prisma 同期・デプロイ |
| 10 | [その他仕様書](./10-miscellaneous-specification.md) | その他 | 用語集・参照資料（Issue）・付録 |
| 11 | [タスク](./11-tasks.md) | タスク | 役割・進行フロー・タスク状態（S1-S8 / B1-B4） |

## assets/ — スクリーンショット

README で参照する画像を格納する。撮影の再生成手順は [`assets/README.md`](./assets/README.md) を参照。

| ファイル | 内容 |
|---|---|
| [`dashboard.png`](./assets/dashboard.png) | ダッシュボード（`/`） |
| [`stats.png`](./assets/stats.png) | 統計レポート（`/stats`） |
| [`book-detail.png`](./assets/book-detail.png) | 書籍詳細・進捗（`/books/[id]`） |

## 優先順位（矛盾時）

`08-test-specification.md`（受け入れ E2E）> `02-requirements-specification.md` > `03-functional-specification.md`。

`04`〜`07`・`09` は `02-requirements-specification.md` の詳細分割として扱う。

## 関連

- 開発ルール: [`../CLAUDE.md`](../CLAUDE.md) と [`../.claude/rules/`](../.claude/rules/)
- ドキュメント更新の影響マップ: [`../.claude/rules/documentation.md`](../.claude/rules/documentation.md)（変更種別 → 更新必須ドキュメントの逆引き表）
