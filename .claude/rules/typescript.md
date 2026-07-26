---
description: TypeScript コーディング規約 — ツール・type/interface の使い分け・型定義の配置等、TS 固有の指針
globs: "front/src/**"
---

# TypeScript コーディング規約

共通の `coding-standards.md` に加え、TypeScript 固有の指針を定める。命名規則は Linter 既定に委ね、本書では扱わない。

## ツール

- **コンパイラ**: `tsconfig.json` は **`strict: true`**。加えて `noUncheckedIndexedAccess` / `noImplicitOverride` / `exactOptionalPropertyTypes` の有効化を推奨する。
- **型チェック**: **`tsc --noEmit`** を CI で実行する。Next.js のビルドは型を検査せず通る設定にできるため、**ビルドが通ることは型が正しいことを意味しない**。
- **Linter**: **ESLint**（flat config `front/eslint.config.mjs`）。型情報を使うルール（`no-floating-promises` / `no-misused-promises` / `await-thenable`）を有効にする — **await 漏れは型だけでは検出できない**ため実害が大きい。
- **Formatter**: **Prettier**（デフォルト設定に従う）。**`eslint-config-prettier` を必ず適用**し、ESLint 側の見た目ルールを無効化して競合を防ぐ（導入済み）。
- **JSDoc の強制**: `eslint-plugin-jsdoc`（詳細は `jsdoc.md`）。
- 運用（CI 必須・警告ゼロ・抑制コメントの扱い）は `static-analysis.md` に従う。

## type vs interface

**原則 `type` を使う。** 以下の 2 条件のいずれかに当たる場合のみ `interface` を使う。

- **条件 1: class 契約** — その型を **class が `implements` / `extends` する**
  - 本プロジェクトの `BookRepository`（`lib/repository.ts`）が該当。`LocalStorageRepository` / `ApiRepository` / `PrismaBookRecordRepository` が実装する契約であるため `interface` を使う
- **条件 2: 宣言マージが必要** — 型を**後から拡張する**必要がある
  - ライブラリ型・グローバル型の拡張（`declare global { interface Window { ... } }`）
  - `type` は宣言マージできないため、ここは `interface` でしか実現できない
- **`type` を使う**（上記以外すべて）
  - class が絡まないオブジェクト形状（props・API レスポンス型・ビューモデル）
  - union / 交差 / tuple / 関数型 / mapped・conditional 型などの型演算

宣言マージは「意図せず型が拡張され得る」副作用でもある。**アプリ内部の型に `interface` を選ぶ理由にはしない**（条件 1 か、外部から拡張される前提の型に限る）。

```ts
// 条件 1: class 契約 → interface
interface BookRepository {
  listBooks(): Promise<Book[]>;
}

class LocalStorageRepository implements BookRepository {
  /* ... */
}

// それ以外 → type（props・union・関数型）
type BookStatus = 'reading' | 'finished';
type BookCardProps = { book: Book; onSelect: (id: string) => void };
```

## スキーマバリデーション

**現状、本プロジェクトはスキーマバリデーションライブラリを導入しておらず、`src/lib/validation.ts` の自前 `validate*` 関数で検証している。** この方針を維持する場合:

- **検証ロジックは `validation.ts` に集約する**。Route Handler・コンポーネントに条件式を散らさない。
- **クライアントとサーバーで同じ `validate*` 関数を呼ぶ**。信頼境界が違うため検証自体は両方で必要だが、**ルールの定義は 1 つ**にする（`duplication.md`）。
- 外部入力（API レスポンス・`JSON.parse`・フォーム入力・環境変数）は `unknown` で受け、**検証を通してからドメインに入れる**。

**ライブラリを導入する場合は Zod に統一する**（`yup` / `joi` / `class-validator` と混在させない）。

- **理由**: 検証ライブラリが複数あると、同じ入力ルールを別の書き方で二重定義することになる。Zod なら**スキーマそのものを共有でき**、型を導出できる。
- **型はスキーマから導出する**。`z.infer<typeof schema>` を使い、**同じ形を手書きで二重定義しない**。**スキーマが単一の真実**であり、型はその影である。
- 用途別のアダプタを使う（`react-hook-form` の `zodResolver` 等）。**アダプタは変わってもスキーマは変わらない**。

## 型定義の配置

型を各ファイルに散在させず、**参照範囲**で置き場所を決める。判断軸は「**その型を参照するファイルが 1 つに閉じるか**」。

| 参照範囲 | 置き場所 |
|---|---|
| **1 ファイルに閉じる** | その定義ファイル内にコロケーション（`export` しない） |
| **2 ファイル以上** / レイヤ・機能をまたぐ | `lib/types.ts` に集約して `export` |

### 運用ルール

- **最初から `lib/types.ts` に置かない。** まず定義ファイル内に書き、**2 箇所目の参照が発生した時点で昇格**させる。先回りの集約は、使われない共通型と不要な依存を増やす。
- **昇格時は元ファイルに型を残さない**（re-export も含む）。定義は常に 1 箇所。
- `lib/types.ts` が肥大化したらドメイン単位でファイルを分ける（`lib/types/book.ts` 等）。その際も **barrel（`index.ts` からの一括 re-export）は作らない**。循環参照・バンドル肥大・tree-shaking 阻害の原因になる。実ファイルを直接 import する。

### 分類の目安

- **`lib/types.ts` に置く**: API レスポンス/リクエスト型、ドメインエンティティ（`Book` / `ProgressLog` / `Reflection`）、複数画面で共有する union リテラル
- **コロケーションのまま**: コンポーネントの props 型（コンポーネントと 1:1 で、UI の変更と同時に変わる）、そのファイル内でしか使わない内部型

### 型へのコメント

`type` / `interface` は**型本体・各メンバーともにコメント必須**。何を書くか（単位・省略の意味・不変条件・union 各値の状態）は `jsdoc.md`「型定義のコメント」に従う。

## 定数の配置

**マジックナンバー・マジック文字列を直接書かない。** 分岐条件・API パス・ストレージキー・上限値などのリテラルは名前付き定数にする。名前が付いていない値は、検索もできず変更漏れも検出できない。

置き場所は型と**同じ「参照範囲」の軸**で決める。

| 参照範囲 | 置き場所 |
|---|---|
| **1 ファイルに閉じる** | その定義ファイルの先頭で `const` 宣言（`export` しない） |
| **2 ファイル以上** / レイヤ・機能をまたぐ | `lib/constants.ts` に集約して `export` |

### 運用ルール

- **`lib/helpers.ts` に定数を混ぜない。** 「関数の置き場」と「値の置き場」を分けると、変更時に探す範囲が狭まる。
- 昇格の運用は型と同じ: まず使う場所に書き、**2 箇所目の参照が発生した時点で `constants.ts` へ移す**。移動時は元ファイルに残さない（re-export も含む）。
- **`as const` を付ける。** 付けないとリテラル型が `string` / `number` に広がり、union の導出や補完が効かなくなる。
- 命名は `UPPER_SNAKE_CASE`。オブジェクト定数のキーも同様に揃える。

### 型の元になる定数は「型と同じファイル」に置く

union リテラルの元になる配列・オブジェクトは、**導出される型とセットで `lib/types.ts` 側に置く**。`constants.ts` と `types.ts` に分けると、値と型が常に往復参照になり、片方だけ更新される事故が起きる。

```ts
// lib/types.ts — 値と型はペアで同居させる
/** 書籍の読書状態。表示順もこの配列の順序に従う。 */
export const BOOK_STATUSES = ['unread', 'reading', 'finished'] as const;
/** 書籍の読書状態。完読判定は進捗ページ数と総ページ数の一致で決まる */
export type BookStatus = (typeof BOOK_STATUSES)[number];

// lib/constants.ts — 型を導出しない純粋な値はこちら
/** 週次集計の対象期間（日数）。docs/03 の業務ルールに従う */
export const WEEKLY_SUMMARY_DAYS = 7;
```

### 環境変数は定数ではない

環境ごとに値が変わるもの（`NEXT_PUBLIC_REPOSITORY_DRIVER`・Supabase の URL / キー・`DATABASE_URL`）を `constants.ts` に置かない。ビルド時に特定環境の値が埋め込まれ、環境差異の事故につながる。**設定は env を読み込む層に分離する**。`constants.ts` に置くのは**全環境で不変な値**だけ。

### 定数へのコメント

`export` された定数は**コメント必須**（`jsdoc.md`）。特に**単位**（`TIMEOUT_MS` がミリ秒であること）と**その値である根拠**（「仕様書 docs/03 の週次集計が 7 日単位のため」）を書く。根拠のない数値は、後から誰も変更してよいか判断できない。

## any 禁止・unknown 優先

- **暗黙・明示を問わず `any` を禁止**する（`noImplicitAny` 前提）。
- 外部入力（API レスポンス・`JSON.parse`・ユーザー入力・`localStorage` の読み出し）は **`unknown` で受け**、型ガード・`parse*` 関数で**ナローイング**してから使う。
- どうしても `any` が必要な箇所は根拠コメントを残す（「as / ! 抑制」節参照）。

## enum 回避・union リテラル + as const

- `enum` より **union リテラル型**＋必要なら **`as const`** を優先する。
- 理由: `enum` はランタイムにオブジェクトを生成しバンドルに残る／tree-shaking されにくい／`const enum` は分離コンパイルで問題が出る。union リテラルは型のみで**ランタイムコストゼロ**。

```ts
// 非推奨
enum Status { Unread, Reading, Finished }
// 推奨
const STATUSES = ['unread', 'reading', 'finished'] as const;
type Status = (typeof STATUSES)[number];
```

## import type 強制

- 型だけを import する場合は **`import type`** を使う（値と型を混ぜない）。
- 理由: バンドラ／トランスパイラが型を確実に消せる、副作用のない循環参照を避けられる。`verbatimModuleSyntax` 有効化を推奨。

```ts
import type { Book } from '@/lib/types';
import { sortBooks } from '@/lib/helpers';
```

## as / ! 抑制

- 型アサーション `as` と non-null assertion `!` を**最小化**する。まず型ガード・早期 return・オプショナルチェーンで解決する。
- 使う場合は**根拠コメント必須**（なぜ安全か／なぜ必要か）。`as unknown as` / `as any` / `@ts-ignore` / `@ts-expect-error` の根拠記述は `jsdoc.md`（混乱テスト）と接続する。
- `as const`（リテラル固定）はここでの「アサーション」に含まない（推奨用途）。
