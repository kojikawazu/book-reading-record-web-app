# その他仕様書（Miscellaneous Specification）

用語集・参照資料・付録など、他の仕様書に属さない補足情報をまとめる。

## 目次

- [1. 用語集](#1-用語集)
- [2. 参照資料](#2-参照資料)
  - [2.1 バックログ Issue](#21-バックログ-issue)
  - [2.2 関連ドキュメント索引](#22-関連ドキュメント索引)
- [3. 付録](#3-付録)

## 1. 用語集

| 用語 | 定義 |
|---|---|
| 完読 | `currentPage >= totalPages` を満たし、`status=completed` となった状態 |
| 再読 | 完読済み書籍を `reading` へ戻すこと。`currentPage=0`・`completedAt` 解除・`reflection` 保持 |
| 感想未記入 | `status=completed` かつ `reflection` 未登録、または `learning`/`action`/`quote` がすべて空（trim後） |
| ドライバー | データ永続化先の切替設定。`NEXT_PUBLIC_REPOSITORY_DRIVER` の値（`supabase` / `local`） |
| `supabase` モード | Supabase PostgreSQL（Prisma）を永続化先とする通常運用モード |
| `local` モード | localStorage を永続化先とする E2E・ローカル受け入れ用モード |
| 週次サマリー | 直近7日（当日含む）の読了ページ数・進捗記録回数・感想数の集計 |

## 2. 参照資料

### 2.1 バックログ Issue
- Issue #9: 書籍削除機能の追加（B1）
- Issue #10: 書籍イメージ（書影）表示の追加（B2）
- Issue #11: 書籍登録で著者名を任意入力に変更（B3）
- Issue #12: 総ページ数未入力でも完読更新を許可（B4）

詳細なタスク状態は `docs/11-tasks.md` を参照する。

### 2.2 関連ドキュメント索引
- `docs/01-business-requirements.md` — 要求仕様（背景・スコープ・制約）
- `docs/02-requirements-specification.md` — 要件仕様（機能要件・優先度）
- `docs/03-functional-specification.md` — 機能仕様（UI/UX・業務ルール）
- `docs/04-non-functional-specification.md` — 非機能仕様
- `docs/05-data-specification.md` — データ仕様
- `docs/06-security-specification.md` — セキュリティ仕様（認証・RLS・検証）
- `docs/07-api-specification.md` — API/Repository 仕様
- `docs/08-test-specification.md` — テスト仕様（受け入れE2E含む）
- `docs/09-architecture-specification.md` — アーキテクチャ仕様
- `docs/11-tasks.md` — タスク・体制・進行フロー

## 3. 付録

- 本プロジェクトは単一ユーザー向け MVP であり、ユーザー/プロフィールのデータモデルは混入させない。
- `base/` は参照専用であり、編集しない。
