# Book Reading Record Web App

読書記録（ページ進捗・完読感想・再読）を管理する単一ユーザー向けMVP。

## Rules

明示的な指示がなくても、`.claude/rules/` 内のルールを**スコープに関わらず常に守ってください**。下表のスコープは「主にどの領域の話か」を示す索引であり、適用範囲を絞るものではありません。

**対象パスの詳細は各ルールファイルの `globs`（frontmatter）を正とします。** ここにパスを再掲すると二重管理になり、片方だけ更新される事故が起きるためです（`duplication.md`）。

**この表がルール索引の正本です。** Codex 向けの入口は [`AGENTS.md`](./AGENTS.md) ですが、そちらは一覧を持たずこの表を参照します（同じ理由で二重管理を避けるため）。

| ファイル | スコープ | 内容 |
|---------|---------|------|
| shortcuts.md | 全体 | 指示ショートカット（PR出して、PR承認しました 等） |
| codex.md | 全体 | Codex 利用時の運用差分（AGENTS.md の階層適用・PR 承認/マージをしない・読み替え） |
| workflow.md | 全体 | 開発フロー（ブランチ運用・テスト必須） |
| quality-gate.md | 全体 | 品質ゲート（セルフレビュー・設計/実装レビュー） |
| documentation.md | 全体 | ドキュメント更新ルール |
| lessons-learned.md | 全体 | 教訓の記録（docs/lessons-learned.md へ追記・トリガー限定・ルールへの昇格） |
| git.md | 全体 | GitHub Flow・ブランチ命名・push 禁止物 |
| github-issue.md | 全体 | GitHub issue 運用（ブランチと対で起票・open/close で進捗管理・サブ issue） |
| pr-description.md | 全体 | PR 本文の必須セクション（変更種別ごとに固定・省略禁止・スコープ外の明示） |
| testing.md | 全体 | テスト分類・原則・3層(UT/IT/E2E)・モック/DBコンテナ方針・テスト配置・テストDB接続先ガード |
| coding-standards.md | 全体 | コーディング規約（TypeScript strict・pnpm・ESLint/Prettier） |
| duplication.md | 全体 | 重複と共通化の判断基準（同じ知識のみ共通化・3回目で共通化） |
| static-analysis.md | 全体 | 静的解析の運用（Formatter/Linter の役割分担・CI 必須・警告ゼロ・秘匿ファイルの混入検出） |
| dead-code.md | 全体 | デッドコード禁止（コメントアウト・未使用 export・スキップ放置テスト） |
| error-handling.md | 全体 | エラーハンドリング方針（バリデーション・HTTP ステータス・統一レスポンス） |
| security.md | 全体 | セキュリティ共通方針（認証・通信・インジェクション・シークレット） |
| production-data.md | 全体 | 本番データの保護（破壊的操作の禁止・環境分離・AI エージェント制約・例外手順） |
| github-actions.md | CI | ワークフローの静的解析（actionlint）と発火ルール（コードとドキュメントを別フィルタ・別ジョブ・必須チェックと paths-ignore を併用しない） |
| vercel.md | デプロイ | Vercel のデプロイ制御（ブランチ単位の deploymentEnabled・ignoreCommand は入れない） |
| typescript.md | TS コード | TypeScript 固有規約（type/interface・型/定数の配置・any 禁止・import type） |
| jsdoc.md | TS コード | JSDoc(TSDoc) 規約（公開シンボルに必須・型定義のコメント） |
| frontend.md | フロント | フロント設計（Repository パターン・server-first・レイヤ一方向依存・ロジック分離） |
| api.md | API | Route Handlers（一体型 API・Prisma 委譲・認可・レスポンス整形） |
| database.md | DB | Prisma（db pull 運用・BookRecord* 命名・共通フィールド・削除方針・RLS） |

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

番号を振らない継続記録として `docs/lessons-learned.md`（教訓ログ）を置く。連番仕様書が「埋めて完成させる」ものであるのに対し、こちらは事象のたびに追記し続ける。
