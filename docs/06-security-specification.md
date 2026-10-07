# セキュリティ仕様書（Security Specification）

入力検証、認証・認可、RLS、XSS 対策、秘密情報管理を定義する。エンドポイント別の認可一覧は `docs/07-api-specification.md` を参照する。

## 目次

- [1. 目的](#1-目的)
- [2. 入力検証](#2-入力検証)
- [3. 状態整合性](#3-状態整合性)
- [4. XSS / 安全な表示](#4-xss--安全な表示)
  - [4.1 セキュリティヘッダー](#41-セキュリティヘッダー)
- [5. 秘密情報管理](#5-秘密情報管理)
- [6. 認証契約（Supabase Auth）](#6-認証契約supabase-auth)
- [7. RLSポリシー（Row Level Security）](#7-rlsポリシーrow-level-security)
  - [7.1 方針](#71-方針)
  - [7.2 ポリシー定義](#72-ポリシー定義)
  - [7.3 適用と突合](#73-適用と突合)
  - [7.4 検証方法](#74-検証方法)
- [8. 将来拡張（Phase 2）](#8-将来拡張phase-2)

## 1. 目的

- 入力検証とフロント実装のセキュリティ要件、認証・認可方式を定義する

## 2. 入力検証

- `title`: 必須、1-200文字
- `author`: 任意、0-120文字。空文字（空白のみを含む）は「未設定」として許容する
- `genre`: 任意、0-80文字
- `totalPages`: 任意、1-100000 の整数。`0` は「未入力」として許容する
- `currentPage`: 0-100000 の整数（書籍登録時は `0` を自動設定）
- `memo`: 任意、0-5000文字
- `learning`: 任意、0-5000文字
- `action`: 任意、0-5000文字
- `quote`: 任意、0-5000文字
- `tags`: 任意、最大10件、各1-30文字

## 3. 状態整合性

- `totalPages >= 1`（入力済み）の場合
  - `currentPage >= totalPages` なら保存時に `status=completed` を強制する
  - `currentPage < totalPages` かつ `status=completed` は保存エラー
- `totalPages = 0`（未入力）の場合は上記の突合を行わず、明示的な `status=completed` を許容する
- 再読開始時は `currentPage=0` とする

## 4. XSS / 安全な表示

- `dangerouslySetInnerHTML` を使用しない
- ユーザー入力をHTMLとして解釈しない（Reactの標準エスケープを前提）
- 外部リンクを開く場合は `rel="noopener noreferrer"` を付与する

### 4.1 セキュリティヘッダー

`front/next.config.ts` の `headers()` で、全パス（`/:path*`）のレスポンスに次のヘッダーを付与する（Issue #104）。Next.js もホスティング（Vercel）も、これらを自動では付与しない。

| ヘッダー | 値 | 目的 |
|---|---|---|
| `Content-Security-Policy` | 下表 | XSS が成立した場合に、外部スクリプトの読み込みや外部への送信を止める（強制モード。Issue #109） |
| `X-Content-Type-Options` | `nosniff` | MIME スニッフィングによる意図しないスクリプト実行を防ぐ |
| `X-Frame-Options` | `DENY` | クリックジャッキングを防ぐ（CSP の `frame-ancestors 'none'` を解釈しない古いブラウザ向け） |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | 外部へ遷移するときに URL のパス（書籍 ID など）を送らない |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | 使わないブラウザ機能の権限を閉じる |

#### CSP のディレクティブ

| ディレクティブ | 値 | 理由 |
|---|---|---|
| `default-src` | `'self'` | 個別に指定しないリソースは同一オリジンのみ |
| `base-uri` / `form-action` | `'self'` | `<base>` の書き換えと、外部へのフォーム送信を防ぐ |
| `object-src` | `'none'` | プラグイン（`<object>` / `<embed>`）を使わない |
| `frame-ancestors` | `'none'` | 他サイトへの埋め込みを禁止する |
| `script-src` | `'self' 'unsafe-inline'` | Next.js のハイドレーション用インラインスクリプトのため `'unsafe-inline'` が必要（外すと `script-src-elem` 違反になることを E2E で確認済み）。本番ビルドでは `'unsafe-eval'` が不要なため許可しない |
| `style-src` | `'self' 'unsafe-inline'` | Tailwind / React のインラインスタイルのため |
| `img-src` | `'self' data: blob:` | 外部画像を読み込まないため `https:` は許可しない。書影表示（Issue #10）に着手する際に、画像の配信元だけを足す |
| `font-src` | `'self' data:` | 現在 Web フォントは読み込んでいない（システムフォント）。追加する場合も自己ホストに限り、外部 CDN を許可しない |
| `connect-src` | `'self' <NEXT_PUBLIC_SUPABASE_URL>` | Supabase Auth との通信を許可する。これを欠くと supabase モードの認証が止まる。未設定のビルド（local モード・CI）では `'self'` だけになる |

**観測モード（Report-Only）から始めた理由**: CSP をいきなり強制すると、Google OAuth のコールバック後の Supabase Auth 通信など、ローカルで再現しにくい経路が壊れうる。Report-Only は違反をブラウザに報告するだけでブロックしないため、#104 で Report-Only として導入し、本番で違反 0 件を観測してから強制モード（`Content-Security-Policy`）へ切り替えた（Issue #109）。**Report-Only のままでは XSS を止めない**ため、観測は切り替えのための一時的な段階として扱った。

**ディレクティブを足すとき**（外部画像・Web フォントの追加など）も同じ手順を踏む。強制モードでは違反した読み込み・通信が実際にブロックされ、画面上は無言で失敗することがあるため、E2E の違反チェック（下記）が通ることを確認してからマージする。

**違反の検出**: E2E は全テストで `securitypolicyviolation` イベントを収集し、違反が 1 件でもあれば失敗する（`front/tests/support/e2e-test.ts`）。強制モードでは違反は機能の破損を意味するため、主要フローの違反 0 件を回帰テストで担保する（Report-Only でもこのイベントは発火するため、#104 の観測モードの段階から同じ検査を回している）。

#### 導入時の観測記録（Issue #104 / 2026-10-07）

| 観測対象 | 環境 | 結果 |
|---|---|---|
| E2E 全 50 ケース（一覧・登録・進捗・完読・再読・検索・統計・削除・破損復旧） | ローカル本番ビルド・`local` モード | 違反 0 件 |
| 一覧 `/` · 統計 `/stats` · ログイン `/auth/login` · 登録 `/books/new` · 詳細 `/books/:id`（閲覧のみ） | ローカル本番ビルド・`supabase` モード | 違反 0 件・コンソールエラー 0 件 |
| ログイン（Google OAuth）· 書き込み | 本番 | 未観測（#109 で観測する） |

#### 強制化前の観測記録（Issue #109 / 2026-10-08）

観測時の本番デプロイ: `ba565d6`（PR #114 のマージ時点）。ヘッダーは `Content-Security-Policy-Report-Only` で、`connect-src` に本番の Supabase オリジンが含まれることを確認した。

| 観測対象 | 環境 | 結果 |
|---|---|---|
| 一覧 `/`（データ読み込み完了まで）· 統計 `/stats` · ログイン `/auth/login` · 詳細 `/books/:id`（未ログイン表示） | 本番・未ログイン | 違反 0 件・コンソール出力 0 件。読み込んだリソースは同一オリジンのみ |
| 「Googleでログイン」押下 → Supabase の認可 URL への遷移 | 本番 | ブラウザ上では未操作。`signInWithOAuth` はトップレベル遷移（`location` の書き換え）で認可 URL へ移り、フォーム送信を使わないため、`form-action` を含め CSP の対象外であることをコードで確認した |
| ログイン後のセッション確立 · 書籍登録 · 進捗記録 · 感想保存 · 削除 | 本番・ログイン後 | **要確認（PR #115 のマージ前に観測する）** |

**nonce 化を見送る判断**: `'unsafe-inline'` をやめて nonce 方式にするには、リクエストごとに nonce を発行する `middleware.ts`（Next.js 16 では `proxy.ts`）の新設が必要になり、全リクエストに処理を挟む構成変更になる。強制化そのものに nonce は不要なので、まず強制モードを有効にして「違反が実際にブロックされる」状態を早く得ることを優先し、nonce 化は別途判断する（md-view-my-collection と同じ判断）。

## 5. 秘密情報管理

- `.env.local` を利用し、秘密情報をリポジトリにコミットしない
- Phase 2（Supabase接続時）は `service_role` キーをクライアントに露出しない

## 6. 認証契約（Supabase Auth）

- ログイン方式は Supabase Auth の Google OAuth を利用する
- クライアントは `ApiRepository` から `/api/book-record/*` を呼び出す際、Supabaseセッションが存在する場合のみ `Authorization: Bearer <token>` を送信する
- 閲覧系GET（`GET /api/book-record/books` / `GET /api/book-record/books/[id]` / `GET /api/book-record/books/[id]/progress-logs`）は未認証でも利用できる
- 更新系（`POST /api/book-record/books` / `PATCH /api/book-record/books/[id]` / `DELETE /api/book-record/books/[id]` / `POST /api/book-record/books/[id]/progress-logs` / `POST /api/book-record/books/[id]/reflection`）は**管理者のみ**が実行できる（Issue #103）。判定は `src/lib/server/auth-guard.ts` の `requireAdmin` に集約する
  - `Authorization: Bearer <token>` を Supabase Auth（`auth.getUser`）で検証し、解決したユーザーのメールアドレスがサーバー専用の環境変数 `ADMIN_EMAIL` と一致する場合のみ許可する（前後空白を除き、大文字小文字を区別しない完全一致）
  - トークン欠落・無効は `401`、トークンは有効だがメールが一致しない（またはメールを持たない）ユーザーは `403`
  - `ADMIN_EMAIL` または Supabase の環境変数が未設定の場合は `500` で**全書き込みを拒否する**（設定漏れを「誰でも書ける」に倒さない）
  - `ADMIN_EMAIL` に `NEXT_PUBLIC_` を付けない（管理者のアドレスをクライアントバンドルへ露出させない）
- 共有 Supabase Auth にサインインできること自体は書き込み権限を意味しない。サインアップの可否は Supabase 側の設定であり、本アプリの認可はそれに依存しない
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` はこのリポジトリの `.env.local` では管理しない（Supabase Authプロジェクト側で管理する）

## 7. RLSポリシー（Row Level Security）

### 7.1 方針

- `BookRecord*` テーブルはすべて RLS を有効にする
- Prisma（`DATABASE_URL` 接続）はDBオーナーロールのため RLS をバイパスする
- RLSポリシーは防御の深度（Defense-in-depth）として設定し、Supabase クライアント（`anon` / `authenticated` ロール）からの直接アクセスを制御する
- ポリシー設計はアプリケーション層の認証契約（§6）と一致させる

### 7.2 ポリシー定義

| テーブル | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `BookRecordBooks` | 誰でも可 | 認証必須 | 認証必須 | 認証必須 |
| `BookRecordProgressLogs` | 誰でも可 | 認証必須 | — | 認証必須 |
| `BookRecordReflections` | 誰でも可 | 認証必須 | 認証必須 | 認証必須 |

- `BookRecordProgressLogs` は UPDATE ポリシーなし（進捗ログは追記のみで編集不可）
- ポリシー名は SELECT が `Public read`、INSERT が `Auth write`、UPDATE が `Auth update`、DELETE が `Auth delete`
- 対象ロールはすべて `public`（＝全ロール）。`anon` / `authenticated` を名指ししない

**SQL 定義は `front/prisma/rls-policies.sql` を参照する。** 上表は「誰が何をできるか」の業務上の意図を示し、`USING` / `WITH CHECK` の式は SQL ファイル側を唯一の記述箇所とする（同じ知識を 2 箇所に書かない）。

### 7.3 適用と突合

- **正は本番（共有 Supabase）側にある。** `front/prisma/rls-policies.sql` はその写しであり、このリポジトリから本番へ適用しない（`.claude/rules/database.md`・`.claude/rules/production-data.md`）
- 2026-03-22 に全ポリシーを Supabase SQL Editor で適用済み
- 2026-08-22 に `pg_policies` を参照して写しと突合し、11 ポリシーが一致することを確認した。突合用のクエリは SQL ファイルの冒頭コメントに記載する
- 写しは IT のテストコンテナへ適用され、実挙動が検証される（`docs/08-test-specification.md` §3）

### 7.4 検証方法

- **Prisma は `DATABASE_URL` で DB オーナーとして接続するため RLS をバイパスする**（§7.1）。したがって通常の IT が全件成功してもポリシーは検証されない
- IT は非オーナーロール（`rls_tester`）で接続し、`auth.uid()` の有無で挙動が変わることを確かめる（`front/tests/it/prisma/rls-policies.it.test.ts`）
- 挙動の非対称に注意する。**INSERT の `WITH CHECK` 違反はエラーになるが、UPDATE / DELETE / SELECT はポリシーで弾かれてもエラーにならず対象 0 行になる**

## 8. 将来拡張（Phase 2）

- ユーザープロフィール機能が必要になった時点で、認証方式とデータ分離方式を別途設計する
