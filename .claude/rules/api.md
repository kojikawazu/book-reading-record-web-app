---
description: Next.js Route Handlers（一体型 API）設計・認可ルール
globs: "front/src/app/api/**,front/src/lib/server/**"
---

# API ルール（Next.js Route Handlers / 一体型）

## 設計方針

- 本プロジェクトは**一体型**。別バックエンドを持たず、Next.js App Router の Route Handlers が API を完結する。
- Route Handler は薄く保ち、データ操作は `PrismaBookRecordRepository`（`src/lib/server/prisma-book-record-repository.ts`）へ委譲する。ハンドラーに業務ロジックを埋め込まない。
- クライアント側は `ApiRepository`（`src/lib/api-repository.ts`）から `/api/book-record/*` を呼び出す（`supabase` モード時）。

## ディレクトリ構成

```text
src/app/api/book-record/
├── books/route.ts                     # GET 一覧 / POST 作成
└── books/[id]/
    ├── route.ts                       # GET 取得 / PATCH 更新（再読含む）
    ├── progress-logs/route.ts         # GET 履歴 / POST 進捗追加
    └── reflection/route.ts            # POST 感想保存
```

## レスポンス整形（ORM の行オブジェクトを素通ししない）

- **Prisma が返した行オブジェクトをそのまま `NextResponse.json()` に流さない**。API の責務は「**この画面に必要なものだけ**を返す」ことであり、パススルーは責務放棄にあたる。
- **公開してよいフィールドだけを厳選**して返す（内部 ID・監査カラム・`userId`・他ユーザー情報を漏らさない）。**ブラウザに届いた時点で、画面に表示していなくてもユーザーは全て閲覧できる**。
- 変換は明示的に行う。**スプレッド（`{ ...row, extra }`）で組み立てない** — `schema.prisma` にカラムが増えた瞬間、自動的に公開される。マッパー関数で返すフィールドを列挙する。
- **画面単位のレスポンス型を `lib/types.ts` に定義**し、その形に合わせて整形する。フロントはこの型をそのまま使い、再変換しない（`frontend.md`「型の扱い」）。
- **Route Handler から UI 層（`components/`）を import しない**。API はサーバー側の層であり、UI に依存してはならない（`frontend.md`「レイヤ依存の一方向ルール」と対になる規定）。
- エラーレスポンスも整形する。**Prisma のエラーメッセージ・SQL・スタックトレースをそのまま返さない**（`error-handling.md` に従い `{ message }` のクライアント向けメッセージに変換する）。ログにはスタックトレースを残す。
- **理由**: 過剰公開（over-fetching / 機密漏洩）の防止、DB スキーマ変更がクライアント契約に直接漏れない疎結合化、転送量の削減。

## 共通方針

- RESTful 設計（リソース指向エンドポイント）。レスポンス形式は JSON（`NextResponse.json()`）。
- 入力バリデーションは Route Handler / `src/lib/validation.ts` で実施する。
- エラー時は適切な HTTP ステータスコード（400/401/404/500）と `{ message }` 形式で返す（`docs/07-api-specification.md` §3）。

## 認可

- 閲覧系 GET（books 一覧 / 取得 / progress-logs）は**未認証可**。
- 更新系（POST / PATCH）は `Authorization: Bearer <token>` **必須**。未認証は `401`。認証ガードは `src/lib/server/auth-guard.ts` に集約する。
- 認証契約・RLS の詳細は `docs/06-security-specification.md` を正とする。
