# Book Reading Record Web App

読書記録（ページ進捗・完読感想・再読）を管理する単一ユーザー向けMVP。

## Rules

明示的な指示がなくても、`.claude/rules/` 内のルールを常に守ってください。

| ファイル | スコープ | 内容 |
|---------|---------|------|
| shortcuts.md | 全体 | 指示ショートカット（PR出して、PR承認しました 等） |
| workflow.md | 全体 | 開発フロー（ブランチ運用・テスト必須） |
| quality-gate.md | 全体 | 品質ゲート（セルフレビュー・設計/実装レビュー） |
| documentation.md | 全体 | ドキュメント更新ルール |
| git.md | 全体 | GitHub Flow・ブランチ命名・push 禁止物 |
| testing.md | 全体 | テスト分類・原則・E2E(Playwright)ツール |
| coding-standards.md | 全体 | コーディング規約（TypeScript strict・pnpm・ESLint/Prettier） |
| error-handling.md | 全体 | エラーハンドリング方針（バリデーション・HTTP ステータス・統一レスポンス） |
| security.md | 全体 | セキュリティ共通方針（認証・通信・インジェクション・シークレット） |
| jsdoc.md | front/src/** | JSDoc(TSDoc) 規約（公開シンボルに必須） |
| frontend.md | front/src/app/**, components/**, lib/** | フロント設計（Repository パターン・server-first・ロジック分離） |
| api.md | front/src/app/api/**, lib/server/** | Route Handlers（一体型 API・Prisma 委譲・認可） |
| database.md | front/prisma/**, lib/server/** | Prisma（db pull 運用・BookRecord* 命名・RLS） |

## Docs

仕様書は `docs/` 配下に番号付き（`01`〜`11`）で管理する。

| # | ファイル | 内容 |
|---|---------|------|
| 01 | business-requirements | 要求仕様（背景・スコープ・制約） |
| 02 | requirements-specification | 要件仕様（機能要件・優先度） |
| 03 | functional-specification | 機能仕様（UI/UX・業務ルール） |
| 04 | non-functional-specification | 非機能仕様 |
| 05 | data-specification | データ仕様 |
| 06 | security-specification | セキュリティ仕様（認証・RLS・検証） |
| 07 | api-specification | API/Repository 仕様 |
| 08 | test-specification | テスト仕様（受け入れE2E含む） |
| 09 | architecture-specification | アーキテクチャ仕様 |
| 10 | miscellaneous-specification | その他（用語集・参照） |
| 11 | tasks | タスク・体制・進行フロー |
