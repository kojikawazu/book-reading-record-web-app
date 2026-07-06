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

```
src/app/api/book-record/
├── books/route.ts                     # GET 一覧 / POST 作成
└── books/[id]/
    ├── route.ts                       # GET 取得 / PATCH 更新（再読含む）
    ├── progress-logs/route.ts         # GET 履歴 / POST 進捗追加
    └── reflection/route.ts            # POST 感想保存
```

## 共通方針

- RESTful 設計（リソース指向エンドポイント）。レスポンス形式は JSON（`NextResponse.json()`）。
- 入力バリデーションは Route Handler / `src/lib/validation.ts` で実施する。
- エラー時は適切な HTTP ステータスコード（400/401/404/500）と `{ message }` 形式で返す（`docs/07-api-specification.md` §3）。

## 認可

- 閲覧系 GET（books 一覧 / 取得 / progress-logs）は**未認証可**。
- 更新系（POST / PATCH）は `Authorization: Bearer <token>` **必須**。未認証は `401`。認証ガードは `src/lib/server/auth-guard.ts` に集約する。
- 認証契約・RLS の詳細は `docs/06-security-specification.md` を正とする。
