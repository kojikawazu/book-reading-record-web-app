# Docs 索引

本プロジェクトの仕様書は、`project-init` 標準構成に沿って番号付き 11 ファイルで管理する。

## 読む順（おすすめ）

1. まず全体像 → [01-business-requirements](01-business-requirements.md)（背景・スコープ・制約）
2. 何を作るか → [02-requirements-specification](02-requirements-specification.md)（機能要件・優先度）
3. どう動くか → [03-functional-specification](03-functional-specification.md)（UI/UX・業務ルール）
4. 受け入れ基準 → [08-test-specification](08-test-specification.md)（E2E Case 1-18）

## 一覧

| # | ファイル | 種別 | 概要 |
|---|---|---|---|
| 01 | [01-business-requirements.md](01-business-requirements.md) | 要求仕様 | プロジェクト背景・目標・スコープ・制約・禁止事項 |
| 02 | [02-requirements-specification.md](02-requirements-specification.md) | 要件仕様 | 機能要件一覧・受け入れ条件・優先順位・仕様マップ |
| 03 | [03-functional-specification.md](03-functional-specification.md) | 機能仕様 | 画面・UI/UX（第1部）＋ 状態遷移・集計・並び順（第2部 業務ルール） |
| 04 | [04-non-functional-specification.md](04-non-functional-specification.md) | 非機能仕様 | 性能・ユーザビリティ・信頼性・移植性 |
| 05 | [05-data-specification.md](05-data-specification.md) | データ仕様 | データモデル・ER 図・永続化・破損復旧・DB スキーマ |
| 06 | [06-security-specification.md](06-security-specification.md) | セキュリティ | 入力検証・認証契約・RLS・XSS・秘密情報 |
| 07 | [07-api-specification.md](07-api-specification.md) | API 仕様 | Repository I/F・エラー契約・HTTP エンドポイント |
| 08 | [08-test-specification.md](08-test-specification.md) | テスト仕様 | 実行条件・受け入れ E2E（Case 1-18）・追加 E2E 設計 |
| 09 | [09-architecture-specification.md](09-architecture-specification.md) | アーキテクチャ | 構成図・技術スタック・環境変数・Prisma 同期・デプロイ |
| 10 | [10-miscellaneous-specification.md](10-miscellaneous-specification.md) | その他 | 用語集・参照資料（Issue）・付録 |
| 11 | [11-tasks.md](11-tasks.md) | タスク | 役割・進行フロー・タスク状態（S1-S8 / B1-B4） |

## 優先順位（矛盾時）

`08-test-specification.md`（受け入れ E2E）> `02-requirements-specification.md` > `03-functional-specification.md`

`04`〜`07`・`09` は `02-requirements-specification.md` の詳細分割として扱う。

## 更新ルール

コード変更時のドキュメント更新義務は [`.claude/rules/documentation.md`](../.claude/rules/documentation.md) の「影響マップ」を参照（変更種別 → 更新必須ドキュメントの逆引き表）。
