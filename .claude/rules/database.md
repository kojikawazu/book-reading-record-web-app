---
description: Prisma ORM 命名規約・スキーマ同期（db pull 運用）・クエリ規約
globs: "front/prisma/**,front/src/lib/server/**"
---

# データベースルール（Prisma）

## スキーマ同期フロー（db pull 運用）

> ⚠️ **このリポジトリから `prisma db push` / `prisma migrate` を実行しない**（`docs/01-business-requirements.md` §6・`docs/09-architecture-specification.md` §5）。

- スキーマは既存 Supabase プロジェクトから `db pull` で同期する。`front/prisma/schema.prisma` を正とする。
- 実行コマンド: `cd front && pnpm prisma:pull`。pull 前後で `pnpm prisma:validate` / `pnpm prisma:generate` を実行する。
- テーブル定義の反映（push）は別プロジェクト側で実施する。反映完了後、このリポジトリで再度 `db pull` して同期する。

### 例外: テストコンテナへの `db push`

- **IT / E2E のテスト用 Postgres コンテナに限り `prisma db push` を許可する**。使い捨てコンテナへ `schema.prisma` を materialize する目的で、共有 Supabase プロジェクトには一切接続しない。
- 実行は `DATABASE_URL` がテストコンテナを指すときのみ（`docker-compose.test.yml` 経由）。**共有 Supabase への `db push` / `migrate` は引き続き禁止**（禁止の本質は共有 DB を破壊しないこと）。
- 詳細は `docs/08-test-specification.md`・`.claude/rules/testing.md` を参照。

## 命名規約

- モデル名: PascalCase・単数形。本プロジェクトは物理テーブルに `BookRecord` 接頭辞を付与する。
  - `BookRecordBook`（table `BookRecordBooks`）
  - `BookRecordProgressLog`（table `BookRecordProgressLogs`）
  - `BookRecordReflection`（table `BookRecordReflections`）
- フィールド名: camelCase（例: `bookId`, `createdAt`, `loggedAt`）。
- 論理モデル（`Book` / `ProgressLog` / `Reflection`）は `local` / `supabase` の両モードで維持する（`docs/05-data-specification.md`）。

## クエリ

- Prisma Client のパラメータバインディングを使用する。`$queryRaw` での文字列結合は禁止。
- サーバー側の DB アクセスは `PrismaBookRecordRepository`（`src/lib/server/`）に集約し、Route Handler から直接 Prisma Client を触らない。

## RLS

- `BookRecord*` テーブルは RLS 有効。Prisma（`DATABASE_URL` 接続）は DB オーナーロールのため RLS をバイパスする。
- RLS は防御の深度として設定し、アプリ層の認可契約（`docs/06-security-specification.md` §6・§7）と一致させる。
