---
description: Next.js (App Router) フロントエンド設計・コンポーネント規約
globs: "front/src/app/**,front/src/components/**,front/src/lib/**"
---

# フロントエンドルール（Next.js App Router）

## データアクセス（Repository パターン）

- 画面は**データ永続化の実装を直接参照しない**。必ず `BookRepository` インターフェース（`src/lib/repository.ts`）経由でアクセスする。
- ドライバーは `NEXT_PUBLIC_REPOSITORY_DRIVER` で切り替える（`local` / `supabase`）。実体の解決は `src/lib/repository-instance.ts` に集約する。
- 新しいデータ操作を追加する場合は、まず `BookRepository` インターフェースに定義し、`LocalStorageRepository` と `ApiRepository` の**両実装**を更新する（片方だけ実装しない）。契約は `docs/07-api-specification.md` §2 を正とする。

## サーバー/クライアント分離

- **server-first** を基本とする。データ取得・SEO はサーバーコンポーネントで行う。
- インタラクション・状態を持つコンポーネントは `"use client"` を明示し、UI 描画に専念させる。
- 認証セッションはカスタムフック（`src/lib/use-auth-session.ts`）に集約し、コンポーネントに認証ロジックを散らさない。

## ロジック分離

- ビジネスロジック（集計・並び順・バリデーション・完読判定等）は `src/lib/`（`helpers.ts` / `validation.ts` / `constants.ts`）に切り出し、コンポーネントに埋め込まない。
- 業務ルール（ステータス遷移・週次集計・感想未記入判定・並び順）は `docs/03-functional-specification.md` 第2部を正とする。

## UI 方針

- 全画面は共通シェル `OrganicShell`（`src/components/organic-shell.tsx`）でラップする。
- モバイル優先。エラーメッセージは入力項目の直下に表示する。
- `dangerouslySetInnerHTML` を使用しない（React 標準エスケープを前提）。

## インポート

- `@/*` パスエイリアスを使用する（相対パスの深いネストを避ける）。

## テスト

- E2E: Playwright（`front/e2e/`）。Base URL: `http://localhost:3000`。`local` モードで実行する。
- 単体テストは追加しない（`.claude/rules/testing.md` 参照）。
