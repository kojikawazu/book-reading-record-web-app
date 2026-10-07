---
description: GitHub Actions のルール — ワークフローの静的解析（actionlint）と発火ルール
globs: ".github/workflows/**"
---

# GitHub Actions のルール

本ルールは 2 つを定める。

1. **ワークフローの静的解析**: ワークフロー自体の誤りを actionlint で機械的に潰す。実装は `.github/workflows/actionlint.yml`（コマンドの正本は `Makefile` の `actionlint` ターゲット）。
2. **発火ルール**: **「変更した内容に関係のあるジョブだけを動かす」**。ドキュメントやルールの更新でテスト・ビルド・デプロイを回さない（CI 時間・コストの浪費、キュー待ちによる他 PR のブロック、無意味なデプロイの発生を防ぐ）。実装は `.github/workflows/ci.yml`。

markdownlint の対象・有効ルールは `.markdownlint-cli2.jsonc` を単一の真実とする（ローカル実行と CI で同じ設定が効く）。

## ワークフローの静的解析（actionlint）

**ワークフローを追加・変更したら、[actionlint](https://github.com/rhysd/actionlint) による検証を CI で必須にする。** ワークフローの誤りは「push して実際に動かすまで気づけない」ため、CI 時間を溶かす前に機械で潰す。

検出できるもの:

| 検出内容 | 例 |
|---|---|
| ランナーラベルの誤り | `runs-on: ubuntu-lates`（typo）／未登録のセルフホストラベル |
| アクション入力名の誤り | `actions/checkout@v4` に `fetch-dept:`（正: `fetch-depth`） |
| 式・コンテキストの誤り | 存在しない `steps.<id>.outputs.*` の参照、型の不一致 |
| ジョブ依存の誤り | `needs:` が存在しないジョブ ID を指している |
| **スクリプトインジェクション** | `run: echo "${{ github.event.pull_request.title }}"` のように untrusted input を `run:` へ直接埋め込む（環境変数経由に直す） |
| シェルスクリプトの不備 | `run:` の中身（shellcheck 連携。クォート漏れ等） |
| cron 式・glob の誤り | `schedule` の cron 構文、`branches` のパターン |

**検出できないもの**（機械では判断できないため、レビューで見る）: ブランチ名・パスフィルタの内容が意図と合っているか、参照しているシークレットが実在するか、ジョブの実行順序が業務的に正しいか。

### CI での実行

`.github/workflows/actionlint.yml` として**独立したワークフロー**で実行する。`ci.yml` のジョブとして持たない。

- **パスフィルタをかけず、全 PR で常に実行する**。実行は数秒で終わるため、「ワークフローを変更したときだけ動かす」ための判定ジョブ（`changes`）を経由させると**判定のほうが検査より高くつく**。常時起動なので必須チェックにしても pending で詰まらない。
- **`actions/checkout` を必ず先に置く**。actionlint は Git リポジトリの中から `.github/workflows` を探すため、リポジトリ外で実行するとエラー終了する。
- **CI とローカルで同じコマンド（`make actionlint`）を呼ぶ**。実体は**公式 Docker イメージ**（`rhysd/actionlint`）で、actionlint 本体と shellcheck / pyflakes が同梱されている。コマンド文字列を workflow と手元の手順に書き写さない（`duplication.md`）。
- **イメージはタグと digest の双方で固定する**（`Makefile` の `ACTIONLINT_IMAGE`）。`latest` にすると、コードを変えていないのに新リリースの検査強化で CI が落ちる。digest まで固定すると、同じタグの再プッシュ（すり替え）も検知される。更新は依存更新として明示的に行う（`Makefile` 内のイメージは Dependabot では更新されない）。
- **shellcheck をランナーのプリインストールに頼らない**。イメージ同梱の shellcheck を使うことで、CI とローカルで `run:` の中身を検査するバージョンが揃う。
- **このジョブにシークレットを渡さず `permissions: contents: read` に絞る**。外部（Docker Hub）から取得したものを実行するため、万一取得物が不正でも読み取り専用のチェックアウト以外に到達できないようにする。

### ローカルでの実行

- **push する前に手元で `make actionlint` を実行する**（要 Docker）。`.github/workflows` を自動検出して全ワークフローを検査し、指摘があれば終了コード 1 で落ちる。
- **`brew install actionlint` / `go install` を既定の手段にしない。** どちらも shellcheck を連れてこないため、**手元に shellcheck が無いと `run:` の中身の検査だけが静かに飛ぶ**（エラーにも警告にもならず exit 0）。「手元では通ったのに CI で落ちる」が、レビューで最も見落とされる層で起きる。
- Docker が使えない環境に限り、バイナリと **`brew install shellcheck` を併せて入れる**。要件は「**CI とローカルで shellcheck の有無を一致させること**」であり、手段はその次である。

### 抑制と設定

抑制の作法（理由を書く・範囲を最小にする・増えたら設定自体を見直す）は `static-analysis.md` に従う。actionlint 固有の手段は以下:

| 目的 | 手段 |
|---|---|
| セルフホストランナーのラベルを認識させる | `.github/actionlint.yaml` の `self-hosted-runner.labels` に登録する（`actionlint -init-config` で雛形を生成できる） |
| 特定のエラーメッセージを無視する | `-ignore <正規表現>`（繰り返し指定可）／`.github/actionlint.yaml` の `paths.<glob>.ignore` |
| shellcheck の特定ルールを無視する | 該当箇所の直前に `# shellcheck disable=SC2086` を書く（`run:` 内の対象行のみ） |

- **リポジトリ単位・ワークフロー単位での一括無効化をしない**。無視するなら対象を絞り、設定ファイルに理由をコメントで残す。

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
| `.github/workflows/**` | ✅（自身の検証のため） | ❌ | — |
| 依存関係（`pnpm-lock.yaml`） | ✅ | ✅ | — |
| `front/prisma/schema.prisma` | ✅（IT が DB スキーマに依存するため） | ✅ | `prisma validate` |

- **actionlint は上表の対象外**。パスフィルタを持たない独立ワークフローとして全 PR で常に走る（前節「CI での実行」）。上表は `ci.yml` の中の判定を指す。
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

**判定は glob マッチャに任せず、変更ファイル一覧への明示的なパターン照合で行う。**

`dorny/paths-filter` は**フィルタ内の複数パターンを OR で評価する**ため、「`docs/` でも `.claude/` でも `*.md` でもない」という **AND 条件を表現できない**。単一の extglob `!(docs/**|**/*.md|.claude/**)` は **`/` を跨げない**ため、`.claude/rules/api.md` や `README.md` が除外されず、ドキュメントだけの PR でもコードレーンが起動する（本リポジトリで実際に発生した）。

```yaml
on:
  pull_request:
    branches: [main]

jobs:
  changes:                      # 変更範囲を判定する（判定は用途ごとに独立させる）
    runs-on: ubuntu-latest
    outputs:
      code: ${{ steps.filter.outputs.code }}
      docs: ${{ steps.filter.outputs.docs }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # merge-base の算出に全履歴が要る
      - id: filter
        env:
          # ${{ }} を run: に直接埋め込まない（コマンドインジェクション対策）
          BASE_SHA: ${{ github.event_name == 'pull_request' && github.event.pull_request.base.sha || github.event.before }}
        run: |
          set -euo pipefail
          files=$(git diff --name-only "$(git merge-base "$BASE_SHA" HEAD)" HEAD)
          emit() {
            if [ -n "$2" ]; then echo "$1=true" >> "$GITHUB_OUTPUT"
            else echo "$1=false" >> "$GITHUB_OUTPUT"; fi
          }
          docs_re='(^|/)[^/]*\.md$|^docs/|^\.claude/'
          # code は docs の否定（＝除外リスト方式）で求める
          emit code "$(printf '%s\n' "$files" | grep -vE "$docs_re" || true)"
          emit docs "$(printf '%s\n' "$files" | grep -E  "$docs_re" || true)"

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
- **`code` は「除外リストの否定」で求める**（`docs/` 等以外はコード変更とみなす）。「対象リスト」で書くと、**新しいディレクトリが増えたときに黙ってテストが走らなくなる**。安全側に倒す。
- 逆に **`docs` は「対象リスト」で書く**。ドキュメント検査は走りすぎても害が小さく、走らない方が問題になるため、判断の向きがコードとは逆になる。
- **base commit を解決できない場合（初回 push・force push 等）は、全ファイルが変更されたものとして扱う**。判定不能を「変更なし」に倒すと、検査が黙って飛ぶ。
- **変更ファイル一覧をログ（`$GITHUB_STEP_SUMMARY`）に出す**。何がスキップされたか追えないと、スキップは「検査して通った」と見分けがつかない。
- **判定ロジックを変えたら、スキップ経路を実際に踏む PR で確認する**。全ジョブが「起動して成功」しても、それは**スキップが効いていないことの証明にはならない**。
- **`run:` のスクリプトは actionlint 経由で shellcheck にかけられる**。指摘は抑制せず直す（変数の間接参照は避ける・同一ファイルへの連続リダイレクトは `{ ... } >> file` でまとめる）。ローカルでは該当スクリプトを切り出して `shellcheck` を通せる。
- 必須チェックにしないワークフロー（デプロイ等）は、ワークフローレベルの `paths-ignore` を使ってよい（起動そのものを止める方が安価）。

## デプロイの発火

- **デプロイは `main` へのマージを唯一のトリガとする**。PR ブランチから本番へデプロイしない。
- **Environments（`environment:`）を使い、本番は承認ゲートを置く**。シークレットは Environment 単位で管理し、PR からは参照できないようにする。
- **fork からの PR で `pull_request_target` を安易に使わない**。`pull_request_target` は base リポジトリの権限とシークレットで動くため、fork のコードをチェックアウトして実行するとシークレットが漏洩する。
- デプロイ workflow には `concurrency.cancel-in-progress: false` を設定し、**デプロイ途中でのキャンセルによる不整合を防ぐ**。
- **CI から共有 Supabase プロジェクトへ接続しない**（`.claude/rules/database.md`）。DB を伴うジョブは `docker-compose.test.yml` の使い捨てコンテナのみを使う。

## 関連ルールとの分担（重複させない）

| 観点 | 担当ルールファイル |
|---|---|
| どのツールをどのワークフローでどう実行するか（YAML の中身・バージョン固定・権限） | **本ファイル** |
| 静的解析の運用（CI 必須・警告ゼロ・抑制コメントの作法） | `static-analysis.md` |
| Vercel のデプロイをどのブランチで走らせるか | `vercel.md` |

## レビュー観点

- **actionlint にパスフィルタが付いていないか**（付けると判定のほうが検査より高くつく）。**バージョンが `latest` や `main` になっていないか**（コード無変更でも CI が落ちる）。
- ドキュメント・ルールのみの PR で、テストやデプロイが起動していないか。
- コードとドキュメントのフィルタが**独立して評価**されているか（実装 + ドキュメント更新の PR で両方走るか）。
- 逆に、**アプリコードを変更したのに必要なジョブがスキップされていないか**（パスフィルタの書き漏れ）。
- 必須チェックにしているジョブが、ワークフローレベルの `paths` / `paths-ignore` で止められていないか（PR がマージ不能になる）。
- `permissions` が明示され、最小権限になっているか。
