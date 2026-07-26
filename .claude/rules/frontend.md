---
description: Next.js (App Router) フロントエンド設計・コンポーネント規約
globs: "front/src/app/**,front/src/components/**,front/src/hooks/**,front/src/repositories/**,front/src/validation/**,front/src/types/**,front/src/constants/**,front/src/lib/**"
---

# フロントエンドルール（Next.js App Router）

## データアクセス（Repository パターン）

- 画面は**データ永続化の実装を直接参照しない**。必ず `BookRepository` インターフェース（`src/repositories/repository.ts`）経由でアクセスする。
- ドライバーは `NEXT_PUBLIC_REPOSITORY_DRIVER` で切り替える（`local` / `supabase`）。実体の解決は `src/repositories/repository-instance.ts` に集約する。
- 新しいデータ操作を追加する場合は、まず `BookRepository` インターフェースに定義し、`LocalStorageRepository` と `ApiRepository` の**両実装**を更新する（片方だけ実装しない）。契約は `docs/07-api-specification.md` §2 を正とする。

## サーバー/クライアント分離

- **server-first** を基本とする。データ取得・SEO はサーバーコンポーネントで行う。
- インタラクション・状態を持つコンポーネントは `"use client"` を明示し、UI 描画に専念させる。
- 認証セッションはカスタムフック（`src/hooks/use-auth-session.ts`）に集約し、コンポーネントに認証ロジックを散らさない。

## ロジック分離

- ビジネスロジックはコンポーネントに埋め込まず、責務ごとのディレクトリへ切り出す（集計・並び順・完読判定は `src/lib/helpers.ts`、入力検証は `src/validation/`、表示ラベル等の定数は `src/constants/`）。
- 業務ルール（ステータス遷移・週次集計・感想未記入判定・並び順）は `docs/03-functional-specification.md` 第2部を正とする。

## UI 方針

- 全画面は共通シェル `OrganicShell`（`src/components/organic-shell.tsx`）でラップする。
- モバイル優先。エラーメッセージは入力項目の直下に表示する。
- `dangerouslySetInnerHTML` を使用しない（React 標準エスケープを前提）。

## レイヤ依存の一方向ルール

**依存は上位から下位への一方向のみ**。下位レイヤが上位レイヤを import してはならない。

```text
app/  →  components/  →  hooks/  →  repositories/ ・ lib/ ・ validation/  →  types/ ・ constants/
（ルーティング）  （表示）   （状態）    （通信）（業務ロジック）（検証）           （最下層）

                                        lib/server/  ← サーバー専用
                                                        （app/api/ とサーバーコンポーネントのみ）
```

| レイヤ | import してよい | import 禁止 |
|---|---|---|
| `app/` | `components/`, `hooks/`, `repositories/`, `lib/`, `validation/`, `types/`, `constants/`, `lib/server/`（サーバー側のみ） | （なし。app は誰からも参照されない） |
| `components/` | 下位の `components/`, `hooks/`, `types/`, `constants/` | **`app/`**（ページ固有の型・定数を含む）、**`lib/server/`** |
| `hooks/` | `repositories/`, `lib/`, `types/`, `constants/` | **`app/`**, **`components/`**（JSX を返さない） |
| `repositories/` `lib/` `validation/` | `types/`, `constants/`, 同位の下位モジュール | **`app/`**, **`components/`**, **`hooks/`** |
| `lib/server/` | `types/`, `constants/` | **`app/`**, **`components/`**, **`hooks/`**, クライアント側 `repositories/` |
| `types/` `constants/` | （原則どこにも依存しない。`constants/` は `types/` のみ参照可） | 上位レイヤすべて |

- **`components/` 内も一方向**にする。汎用度の高いもの（`organic-shell.tsx`）ほど下位に置き、個別画面用コンポーネントを import しない。
- **`app/api/`（Route Handler）から `components/` を import しない**。API はサーバー側の層であり、UI 層に依存してはならない（`api.md` 参照）。
- **`lib/server/` を Client Component から import しない**。`prisma-client.ts` は `DATABASE_URL` を、`auth-guard.ts` はサーバー専用の検証ロジックを持つため、**クライアントバンドルに混入するとシークレットが漏洩する**。`server-only` パッケージで境界を機械的に守ることを推奨する。
- **カスタムフック（`use-auth-session.ts` 等）は JSX を返さない**。返したくなったらそれはコンポーネントであり、`components/` に置く。

禁止例:

- `components/organic-shell.tsx` が `app/books/page.tsx` の型・定数を import する
- `hooks/use-auth-session.ts` が `components/` を import する
- 同一レイヤ間の**相互依存（循環）**（例: `A.tsx` ⇄ `B.tsx` が互いを import）

### 逆流したくなったら「共通化」で解決する

| 逆流したい理由 | 正しい解き方 |
|---|---|
| 上位の型・定数を下位でも使いたい | その型・定数を **`types/` / `constants/` へ移動**し、上下双方がそこを参照する |
| 上位のロジックを下位でも使いたい | 共通処理を **`lib/helpers.ts` の純粋関数またはカスタムフックへ抽出**し、双方から呼ぶ |
| 下位から上位の状態を変えたい | **呼ばない**。**props でコールバックを受け取る**（イベントは上へ、データは下へ） |
| 子が親のレイアウトを知りたい | 知らせない。**props / children で親が渡す**（子は自分の見た目だけに責任を持つ） |

**レビュー観点**: import 文の向きを見る。下位レイヤのファイルに上位レイヤ（`app/` / `components/`）へのパスが現れていたら指摘する。Client Component が `lib/server/` を引き込んでいないか。

## 型の扱い（API の形を画面に持ち込まない）

**API のレスポンス型と、画面が使う型を分ける。**

| 種類 | 役割 | 置き場所 |
|---|---|---|
| **API 契約の型** | `/api/book-record/*` が返す形。サーバー側の都合で変わる | `src/types/`（Route Handler と共有し 1 箇所定義にする） |
| **ビューモデル** | 画面が必要とする形。UI 要件で変わる | 単一画面用なら該当コンポーネントにコロケーション |

本プロジェクトは**一体型（Route Handler が BFF を兼ねる）**のため、**変換の担当は Route Handler 側**とする（`api.md`「レスポンス整形」）。画面側で受け取った形を**再変換しない**。

- **理由**: Prisma のカラム名変更が画面のあちこちに波及するのを防ぐ。API 契約とビューは**変わる理由が違う**（`duplication.md`「層をまたぐ型は共通化しない」）。
- 表示専用の整形（日付フォーマット・進捗率の表記・ステータス名の解決）は**コンポーネント側または `helpers.ts`** で行い、**API 契約の型に表示都合のフィールドを足さない**。
- ただし**両者が完全に一致し、変換が恒久的に無意味な場合は同じ型を使ってよい**（早すぎる抽象化を避ける）。**表示都合の差が出た時点で分ける**。

## バリデーション

- **クライアント検証は UX のためのものであり、セキュリティ担保ではない**。Route Handler 側でも必ず検証する（信頼境界が違うため、**この重複は必要**な重複である — `duplication.md`）。
- 検証ロジックは `src/validation/book.ts` に集約し、コンポーネントに条件式を散らさない。**同じ入力ルールをクライアントとサーバーで別々に書き下ろさず、同じ `validate*` 関数を双方から呼ぶ**。
- 制約値（ページ数上限・文字数上限等）は `src/constants/` の定数を共有する。数値リテラルを両側に直書きしない。
- **Server Action を導入する場合、その引数も必ずサーバー側で検証する**。Server Action は公開エンドポイントと同等であり、**フォームを経由せず直接呼び出せる**ため、クライアント側のフォーム検証を通ったことを前提にしてはならない（現時点で `front/src` に Server Action は存在しない）。
- **スキーマバリデーションライブラリは未導入**（自前の `validation.ts` 運用）。導入する場合は **Zod に統一**し、`z.infer` で型を導出して同じ形を二重定義しない（`typescript.md` 参照）。`yup` / `joi` 等と混在させない。

## インポート

- `@/*` パスエイリアスを使用する（相対パスの深いネストを避ける）。

## テスト

- UT: Vitest（jsdom）。`helpers` / `validation` / `ApiRepository` / `LocalStorageRepository` を対象とする。
- E2E: Playwright（`front/e2e/`）。Base URL: `http://localhost:3000`。`local` レーンと `supabase` レーンで実行する。
- 詳細な層構成・モック方針は `.claude/rules/testing.md`、受け入れケースは `docs/08-test-specification.md` を正とする。
