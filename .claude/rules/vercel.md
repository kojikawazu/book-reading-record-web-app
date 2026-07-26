---
description: Vercel のデプロイ制御ルール — vercel.json でいつデプロイを走らせるか
globs: "front/vercel.json"
---

# Vercel デプロイ制御ルール

**「デプロイに影響のある変更のときだけデプロイを走らせる」** を原則とする。

Vercel の Git 連携は **GitHub Actions を経由せず push を直接拾う**ため、`.claude/rules/github-actions.md` の変更範囲判定では**デプロイを止められない**。制御は **`vercel.json` 側で行う**。

## vercel.json の配置

- Vercel プロジェクトの **Root Directory 直下**に置く。本プロジェクトは Root Directory が `front/` のため **`front/vercel.json`**（リポジトリ直下ではない）。
- 先頭に `"$schema": "https://openapi.vercel.sh/vercel.json"` を宣言する（エディタ補完とスキーマ検証を効かせるため）。

## 1. ブランチ単位のデプロイ制御（`git.deploymentEnabled`）

- **デプロイを許可するブランチを明示列挙する**。列挙しないブランチは Vercel 側でデプロイが発火しない。
- 既定では**本番ブランチ（`main`）のみ `true`** にする。作業ブランチの push ごとに Preview デプロイを積み上げない。
- Preview 環境が必要な場合（レビューで実物を確認したい等）は、対象ブランチを**明示的に追加**する。「とりあえず全ブランチ許可」にしない。
- `"main": false` のように**本番ブランチを無効化しない**（デプロイ手段が失われる）。

**`ignoreCommand` だけでは Preview ビルドを止めきれない。** 新規ブランチの初回 push では前回コミット（`VERCEL_GIT_PREVIOUS_SHA`）が解決できず、判定不能として安全側（ビルド実行）に倒れるため。ブランチ制御と併用する。

## 2. ビルドスキップ（`ignoreCommand`）

デプロイ成果物に影響しない変更（ドキュメント・AI ルール・CI 定義）だけの push では、ビルドを実行しない。

**終了コードの規約（直感と逆なので必ず守る）**:

| 終了コード | Vercel の挙動 |
|---|---|
| `0` | ビルドを**スキップ**する |
| `1`（非 0） | ビルドを**実行**する |

本プロジェクトは `front/scripts/vercel-ignore-docs.sh` で判定する。**Vercel が渡す `VERCEL_GIT_PREVIOUS_SHA` / `VERCEL_GIT_COMMIT_SHA` を使う**（`HEAD^` は shallow clone や単一コミット履歴で失敗し得るため使わない）。

- **判定不能なとき（SHA が空・diff 取得失敗）はビルドを実行する**（`exit 1`）。判定不能を「スキップ」に倒すと、デプロイ漏れ（本番と最新コードの乖離）が起きる。
- 本プロジェクトの Root Directory は `front/` であり、**ビルド成果物に影響するのは `front/` 配下だけ**。したがって判定は「`front/` に変更があればビルド」の対象リスト方式でよい（`github-actions.md` の CI 判定が除外リスト方式なのとは逆になる。**判定の向きが違う理由は、CI がリポジトリ全体を対象とするのに対し、Vercel は Root Directory に閉じているため**）。
- **`front/pnpm-lock.yaml`・環境変数定義・`front/vercel.json` 自体を除外しない**。

## GitHub Actions との役割分担（重複させない）

| 観点 | 担当 |
|---|---|
| Vercel のデプロイをいつ走らせるか（ブランチ・パス） | 本ファイル ＝ `front/vercel.json` |
| lint / test / build を CI でいつ走らせるか | `github-actions.md` ＝ `.github/workflows/ci.yml` の `changes` ジョブ |

- **両者は判定ロジックが別物であり、片方を直したらもう片方も確認する**。「CI は動かないのにデプロイは走る」という食い違いが起きやすい。
- GitHub Actions から Vercel CLI でデプロイする構成へ移行した場合は、Vercel ダッシュボードで Git 連携を無効化し、発火制御を `github-actions.md` に一本化する（本ファイルの `git.deploymentEnabled` は不要になる）。

## レビュー観点

- ドキュメント・ルールのみの PR で Preview デプロイが走っていないか。
- 逆に、`front/` を変更したのに production デプロイがスキップされていないか。
- `ignoreCommand` の判定が「判定不能 → スキップ」に倒れていないか。
