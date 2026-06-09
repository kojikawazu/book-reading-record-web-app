---
description: ドキュメント更新・設計書管理ルール（影響マップ + opt-out の完了条件）
globs:
---

# ドキュメント

コード変更がドキュメント（CLAUDE.md / README.md / docs/）と乖離しないことを構造的に担保する。

## 完了条件（opt-out）

変更は、下記「影響マップ」の対応ドキュメントを**同一 PR 内で更新する**ことを完了条件とする。

- 更新不要と判断した場合は、**PR 説明にその理由を明記する**（省略＝未対応とみなす）。
- この乖離チェックは `/self-review` と `/pr-create` の確認対象に含まれる。

## 影響マップ（変更種別 → 更新必須ドキュメント）

「どのドキュメントだっけ？」を考えさせないための逆引き表。

| 変更種別 | 更新必須ドキュメント |
|---|---|
| Repository インターフェース / API 契約の変更 | docs/07-api-specification.md |
| データモデル / 永続化仕様（Book・進捗・感想等）の変更 | docs/05-data-specification.md、front/prisma/（スキーマ変更時） |
| 環境変数（`NEXT_PUBLIC_REPOSITORY_DRIVER` 等）の追加・変更 | front/.env.example、README.md、docs/09-architecture-specification.md |
| 依存パッケージ（Next.js / Prisma / Supabase 等）の追加・更新 | README.md、front/README.md |
| ビルド・実行・設定（next.config / vercel.json / scripts）の変更 | README.md、front/README.md、CLAUDE.md、docs/09-architecture-specification.md |
| 新機能 / 画面 / UI レイアウトの追加・変更 | README.md、docs/03-functional-specification.md、docs/02-requirements-specification.md |
| 業務ルール / バリデーション仕様の変更 | docs/03-functional-specification.md、docs/06-security-specification.md |
| E2E / テスト仕様の変更 | docs/08-test-specification.md |
| 開発ルール / 規約の変更 | CLAUDE.md、.claude/rules/ |

該当する変更がない場合はスキップする。

## 補足

- **ドキュメント更新**: 作業が完了したら、ルートドキュメント（CLAUDE.md / README.md / docs/）の更新が必要かどうか確認し、必要であれば更新する。
- **設計書の管理**: タスクごとに設計書を新規作成しない。既存の仕様書ドキュメント（docs/01〜11-*.md）に追記・更新する。
