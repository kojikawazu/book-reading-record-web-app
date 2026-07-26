---
description: GitHub Actions の発火ルール — 何を変更したときに何を動かすか
globs: ".github/workflows/**"
---

# GitHub Actions の発火ルール

**「変更した内容に関係のあるジョブだけを動かす」** を原則とする。ドキュメントやルールの更新でテスト・ビルド・デプロイを回さない（CI 時間・コストの浪費、キュー待ちによる他 PR のブロック、無意味なデプロイの発生を防ぐ）。

## トリガの基本形

| ワークフロー | トリガ | 補足 |
|---|---|---|
| CI（lint / test / build） | `pull_request`（対象: `main`）+ `push`（`main` のみ） | **全ブランチの push で回さない**。PR で回れば十分 |
| CD（デプロイ） | `push`（`main` のみ）または `release` | PR では動かさない |
| 手動運用（再デプロイ・ロールバック） | `workflow_dispatch` | 手動実行の口を必ず用意する |

- **`concurrency` を必ず設定する**。同一 PR で連続 push した際に古い実行をキャンセルする。

  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true   # CD（デプロイ）では false にする（中断で不整合が起きるため）
  ```

- **`permissions` は最小権限**を明示する（既定の広い権限に依存しない）。読み取りだけなら `contents: read`。

## 変更内容と実行対象

| 変更内容 | lint / test / build | デプロイ | 実行する軽量チェック |
|---|---|---|---|
| アプリケーションコード（`front/src/**`） | ✅ | ✅（main マージ時） | — |
| テストコード（`front/e2e/**`・`*.test.ts`） | ✅ | ❌ | — |
| `docs/**`、`*.md`、`README.md` | ❌ | ❌ | markdown lint、リンク切れチェック |
| `.claude/**`（rules / skills） | ❌ | ❌ | markdown lint |
| `.github/workflows/**` | ✅（自身の検証のため） | ❌ | actionlint |
| 依存関係（`pnpm-lock.yaml`） | ✅ | ✅ | — |
| `front/prisma/schema.prisma` | ✅（IT が DB スキーマに依存するため） | ✅ | `prisma validate` |

- **ドキュメント変更でも「何も動かさない」にはしない**。markdown lint・リンク切れ・必須ファイル（README.md / CLAUDE.md）の存在検証は軽量なので実行する。
- **IT（`pnpm test:it`）と E2E(supabase レーン) は DB コンテナ起動を伴い重い**。PR では実行するが、ドキュメント・ルールのみの変更ではスキップする。

## パスフィルタの実装（重要な落とし穴）

**ワークフローレベルの `paths` / `paths-ignore` を、required status check（ブランチ保護の必須チェック）と併用してはならない。**

- ワークフロー自体が起動しないと、必須チェックは **`pending` のまま永久に完了せず、PR がマージできなくなる**。
- 一方、**ジョブレベルの `if:` でスキップした場合は「skipped」となり、必須チェックとしては成功扱い**になる。

したがって、**必須チェックにするジョブは「常に起動し、中身をスキップする」形にする**。

### ドキュメントとコードは別のフィルタ・別のジョブに分ける

**`code` と `docs` は独立した判定であり、発火条件も実行内容も違う。** 1 つのフィルタで両者を兼ねない。

- **コード変更 → lint / 型チェック / テスト / ビルド**（markdown lint は不要）
- **ドキュメント変更 → markdown lint / リンク切れチェック**（テスト・ビルドは不要）
- **両方を含む PR → 両方が走る**。片方の判定がもう片方を抑制してはならない。

```yaml
on:
  pull_request:
    branches: [main]

jobs:
  changes:                      # 変更範囲を判定する（フィルタは用途ごとに独立させる）
    runs-on: ubuntu-latest
    outputs:
      code: ${{ steps.filter.outputs.code }}
      docs: ${{ steps.filter.outputs.docs }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            code:
              - '!(docs/**|**/*.md|.claude/**|LICENSE)'
            docs:
              - 'docs/**'
              - '**/*.md'
              - '.claude/**'

  test:                         # コード変更時のみ中身を実行（必須チェック）
    needs: changes
    if: needs.changes.outputs.code == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "pnpm lint && tsc --noEmit && pnpm test"

  markdown-lint:                # ドキュメント変更時のみ中身を実行（必須チェック）
    needs: changes
    if: needs.changes.outputs.docs == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "markdownlint && lychee (リンク切れ)"
```

- **`code` と `docs` は排他ではない**。両方 `true` になる PR（実装 + ドキュメント更新）が正常系であり、`if/else` 的な二者択一で書かない。`.claude/rules/documentation.md` は「コード変更とドキュメント更新を同一 PR で行う」ことを完了条件としているため、**両方走る PR が最も多くなる**。
- **`code` フィルタは「除外リスト」で書く**（`docs/**` 等以外はコード変更とみなす）。「対象リスト」で書くと、**新しいディレクトリが増えたときに黙ってテストが走らなくなる**。安全側に倒す。
- 逆に **`docs` フィルタは「対象リスト」で書く**。ドキュメント検査は走りすぎても害が小さく、走らない方が問題になるため、判断の向きがコードとは逆になる。
- 必須チェックにしないワークフロー（デプロイ等）は、ワークフローレベルの `paths-ignore` を使ってよい（起動そのものを止める方が安価）。

## デプロイの発火

- **デプロイは `main` へのマージを唯一のトリガとする**。PR ブランチから本番へデプロイしない。
- **Environments（`environment:`）を使い、本番は承認ゲートを置く**。シークレットは Environment 単位で管理し、PR からは参照できないようにする。
- **fork からの PR で `pull_request_target` を安易に使わない**。`pull_request_target` は base リポジトリの権限とシークレットで動くため、fork のコードをチェックアウトして実行するとシークレットが漏洩する。
- デプロイ workflow には `concurrency.cancel-in-progress: false` を設定し、**デプロイ途中でのキャンセルによる不整合を防ぐ**。
- **CI から共有 Supabase プロジェクトへ接続しない**（`.claude/rules/database.md`）。DB を伴うジョブは `docker-compose.test.yml` の使い捨てコンテナのみを使う。

## レビュー観点

- ドキュメント・ルールのみの PR で、テストやデプロイが起動していないか。
- コードとドキュメントのフィルタが**独立して評価**されているか（実装 + ドキュメント更新の PR で両方走るか）。
- 逆に、**アプリコードを変更したのに必要なジョブがスキップされていないか**（パスフィルタの書き漏れ）。
- 必須チェックにしているジョブが、ワークフローレベルの `paths` / `paths-ignore` で止められていないか（PR がマージ不能になる）。
- `permissions` が明示され、最小権限になっているか。
