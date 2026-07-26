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

### `prisma migrate` を採用しない

**マイグレーションファイルによる管理（`prisma migrate dev` / `migrate deploy`）は本プロジェクトでは採用しない。** スキーマの正は共有 Supabase プロジェクト側にあり、このリポジトリは `db pull` でその写しを取るだけだからである。マイグレーション履歴をこちら側に持つと、**正が 2 箇所になり必ず乖離する**。

一般的な Prisma のプラクティスは `migrate` を前提とするため、外部の手順やテンプレートを取り込む際は**この節と矛盾しないか必ず確認する**。

### `schema.prisma` に他プロジェクトのモデルが含まれる

共有 Supabase プロジェクトを他プロジェクトと共用しているため、`db pull` すると**そのプロジェクトの全テーブルが引かれる**。現在 12 モデル中 9 モデルが本プロジェクトと無関係である。

| 区分 | モデル |
|---|---|
| **本プロジェクト** | `BookRecordBook` / `BookRecordProgressLog` / `BookRecordReflection`（+ enum `BookRecordStatus` / `BookRecordFormat`） |
| **他プロジェクト（触らない）** | `ExerciseCardio` / `ExerciseMaster` / `ExerciseProfile` / `ExerciseRecord` / `ExerciseWorkout` / `Report` / `ReportTag` / `ReportTagMapping` / `VideoEntry` |

- **他プロジェクトのモデルを編集・削除しない。** `db pull` で再生成されるため差分は無意味であり、削除しても次回 pull で復活する。
- **`BookRecord` 接頭辞は、この共用環境における名前空間の分離手段**である。新しいテーブルを追加する際も必ず接頭辞を付ける（`命名規約` を参照）。
- `PrismaBookRecordRepository` は `BookRecord*` モデルのみを扱う。他プロジェクトのモデルにアクセスしない。

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

## 共通フィールド

テーブル定義は別プロジェクト側で行うため、ここでは**このリポジトリが期待する形**を定める。`db pull` した結果がこれと食い違う場合は、別プロジェクト側の定義を直す。

| フィールド | 期待する定義 | 備考 |
|---|---|---|
| `id` | `String @id @default(uuid()) @db.Uuid` | 連番は使わない（列挙による他レコードの推測を防ぐ） |
| `createdAt` | `DateTime @default(now()) @map("created_at")` | |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` | |

- 物理カラム名は snake_case、Prisma のフィールド名は camelCase とし、`@map` で対応させる（`命名規約`）。
- **追記専用テーブルは `createdAt` / `updatedAt` を持たなくてよい**。`BookRecordProgressLog` は進捗の追記のみで更新・削除しないため、**記録時刻を表す `loggedAt` だけを持つ**。これは漏れではなく意図的な設計であり、同種のテーブルを追加する場合も同じ扱いでよい。
- 状態の到達時刻など**業務上の意味を持つ日時**は、共通フィールドとは別に定義する（例: `BookRecordBook.completedAt` は完読日時であり、`updatedAt` とは意味が異なる）。

## 削除方針（論理削除を採用しない）

**論理削除（`deletedAt` によるソフトデリート）は採用しない。** 現在、全 12 モデルに `deletedAt` は存在しない。

- 削除は**物理削除**とし、関連レコードは `onDelete: Cascade` で追随させる（`BookRecordProgressLog` / `BookRecordReflection` は `BookRecordBook` の削除で消える）。
- 単一ユーザー向け MVP であり、**削除の取り消し・監査要件が無い**ため。論理削除を採用すると、全読み取りクエリに `where: { deletedAt: null }` の付与が必要になり、付け忘れが情報漏洩に直結する。
- **方針を変える場合はルールを先に更新する。** 一部のテーブルだけ論理削除にすると、削除の意味がテーブルごとに変わり、結合時に消えたはずのデータが現れる。

## クエリ

- Prisma Client のパラメータバインディングを使用する。`$queryRaw` での文字列結合は禁止。
- サーバー側の DB アクセスは `PrismaBookRecordRepository`（`src/lib/server/`）に集約し、Route Handler から直接 Prisma Client を触らない。

## RLS

- `BookRecord*` テーブルは RLS 有効。Prisma（`DATABASE_URL` 接続）は DB オーナーロールのため RLS をバイパスする。
- RLS は防御の深度として設定し、アプリ層の認可契約（`docs/06-security-specification.md` §6・§7）と一致させる。
