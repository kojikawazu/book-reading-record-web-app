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

# 引数なし `make` は help を表示する（誤って dev 等を起動しない安全側）
.DEFAULT_GOAL := help

.PHONY: help \
	install e2e-install \
	dev build start \
	lint lint-fix format format-check check \
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
