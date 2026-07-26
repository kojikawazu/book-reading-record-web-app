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
| github-issue.md | 全体 | GitHub issue 運用（ブランチと対で起票・open/close で進捗管理・サブ issue） |
| testing.md | 全体 | テスト分類・原則・3層(UT/IT/E2E)・モック/DBコンテナ方針 |
| coding-standards.md | 全体 | コーディング規約（TypeScript strict・pnpm・ESLint/Prettier） |
| duplication.md | 全体 | 重複と共通化の判断基準（同じ知識のみ共通化・3回目で共通化） |
| static-analysis.md | 全体 | 静的解析の運用（Formatter/Linter の役割分担・CI 必須・警告ゼロ） |
| dead-code.md | 全体 | デッドコード禁止（コメントアウト・未使用 export・スキップ放置テスト） |
| typescript.md | front/src/** | TypeScript 固有規約（type/interface・型/定数の配置・any 禁止・import type） |
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
