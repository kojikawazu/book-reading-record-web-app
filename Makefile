# Book Reading Record Web App — タスクランナー
#
# 実体は front/package.json の pnpm scripts。本 Makefile はその薄いラッパーで、
# リポジトリルートのどこからでも同じ入口で叩けるようにする（二重管理を避ける）。
# 使い方: `make help` で一覧表示。

# 実装本体のディレクトリ（全 pnpm ターゲットはここで実行する）
FRONT := front
# IT / E2E(supabase レーン) 用の使い捨て Postgres（共有 Supabase には接続しない）
COMPOSE_FILE := $(FRONT)/docker-compose.test.yml
DB_SERVICE := db

# actionlint の公式イメージ。actionlint 本体と shellcheck / pyflakes が同梱されており、
# run: の中のシェルまで必ず検査される（brew の actionlint は shellcheck を連れてこない）。
# タグに加えて digest でも固定し、CI とローカルで中身まで同一のイメージを使う。
# 更新は手で行う（Dependabot は Makefile 内のイメージを更新しない）。
ACTIONLINT_IMAGE := rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667

# 引数なし `make` は help を表示する（誤って dev 等を起動しない安全側）
.DEFAULT_GOAL := help

.PHONY: help \
	install e2e-install \
	dev build start \
	lint lint-fix format format-check check secret-scan actionlint \
	test test-watch test-it test-e2e test-e2e-ui test-e2e-headed test-all \
	prisma-generate prisma-pull prisma-validate \
	db-up db-down db-logs db-psql \
	screenshots clean

## ---- Setup ----------------------------------------------------------------

install: ## 依存パッケージをインストール（pnpm install）
	cd $(FRONT) && pnpm install

e2e-install: ## Playwright 用 Chromium をインストール
	cd $(FRONT) && pnpm test:e2e:install

## ---- Develop --------------------------------------------------------------

dev: ## 開発サーバーを起動（next dev）
	cd $(FRONT) && pnpm dev

build: ## 本番ビルド（内部で prisma generate を実行）
	cd $(FRONT) && pnpm build

start: ## ビルド済みアプリを起動（next start）
	cd $(FRONT) && pnpm start

## ---- Quality (static gate) ------------------------------------------------

lint: ## ESLint を実行
	cd $(FRONT) && pnpm lint

lint-fix: ## ESLint を自動修正付きで実行
	cd $(FRONT) && pnpm lint:fix

format: ## Prettier で整形（書き込み）
	cd $(FRONT) && pnpm format

format-check: ## Prettier の整形チェック（CI 相当）
	cd $(FRONT) && pnpm format:check

check: format-check lint ## 静的ゲート一括（format:check → lint）

secret-scan: ## 鍵・.env が Git 管理下（または追跡候補）にないか検査（CI と同じスクリプト）
	./scripts/check-secret-files.sh

# check には含めない。ワークフローを触るときしか要らず、Docker も必要になるため。
actionlint: ## GitHub Actions のワークフローを検査（shellcheck 込み・要 Docker・CI と同じコマンド）
	docker run --rm -v "$(CURDIR)":/repo -w /repo $(ACTIONLINT_IMAGE) -color

## ---- Test (3層: UT / IT / E2E) --------------------------------------------

test: ## UT（Vitest / jsdom・DB 不要）
	cd $(FRONT) && pnpm test

test-watch: ## UT を watch モードで実行
	cd $(FRONT) && pnpm test:watch

test-it: ## IT（Vitest / node・DB コンテナで実 Postgres・要 Docker）
	cd $(FRONT) && pnpm test:it

test-e2e: ## E2E（Playwright / Chromium・local レーン）
	cd $(FRONT) && pnpm test:e2e

test-e2e-ui: ## E2E を UI モードで起動
	cd $(FRONT) && pnpm test:e2e:ui

test-e2e-headed: ## E2E をヘッド付きで起動
	cd $(FRONT) && pnpm test:e2e:headed

test-all: test test-it test-e2e ## UT → IT → E2E を順に実行

## ---- Prisma ---------------------------------------------------------------

prisma-generate: ## Prisma Client を生成
	cd $(FRONT) && pnpm prisma:generate

prisma-pull: ## 既存 Supabase から schema を db pull（共有 DB へ push しない）
	cd $(FRONT) && pnpm prisma:pull

prisma-validate: ## schema.prisma を検証
	cd $(FRONT) && pnpm prisma:validate

## ---- Test DB container (使い捨て Postgres) ---------------------------------

db-up: ## テスト用 Postgres を起動（healthy まで待機）
	docker compose -f $(COMPOSE_FILE) up -d --wait

db-down: ## テスト用 Postgres を停止しボリューム破棄
	cd $(FRONT) && pnpm test:it:down

db-logs: ## テスト用 Postgres のログを追従表示
	docker compose -f $(COMPOSE_FILE) logs -f $(DB_SERVICE)

db-psql: ## テスト用 Postgres に psql 接続
	docker compose -f $(COMPOSE_FILE) exec $(DB_SERVICE) psql -U postgres -d book_record_test

## ---- Misc -----------------------------------------------------------------

screenshots: ## docs/assets 用スクリーンショットを再生成
	cd $(FRONT) && pnpm screenshots

clean: ## ビルド生成物とテスト用 DB コンテナを掃除
	cd $(FRONT) && rm -rf .next test-results
	-docker compose -f $(COMPOSE_FILE) down -v

help: ## このヘルプを表示
	@echo "Book Reading Record Web App — make targets"
	@echo ""
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
