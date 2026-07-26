---
description: JSDoc（TSDoc）ドキュメンテーションコメント規約 — TypeScript の公開シンボルに必須
globs: "front/src/**"
---

# JSDoc 規約（TypeScript）

TypeScript コードの**公開シンボル**には JSDoc（TSDoc 記法）を**必須**とする。TypeDoc によるドキュメント生成を前提とする。

## 必須対象（公開シンボル）

以下の公開シンボルには JSDoc を必ず付与する:

- `export` された関数・クラス・メソッド・型（`type` / `interface`）・定数
- React コンポーネントの **props 型**（各プロパティに説明）
- カスタムフック（`useXxx`）
- 公開 API のハンドラー・サービスメソッド（Route Handler / Repository 実装）

**任意対象**: `export` されない内部関数、および処理が自明な 1 行ユーティリティ。ただし意図が非自明なものは内部でも付与する。

## 型定義のコメント（型本体 + メンバー）

`type` / `interface` は**型本体と各メンバーの両方**にコメントを付ける。型シグネチャは「形」しか語らないため、**意味・単位・制約・状態の定義**はコメントでしか残せない。

- **型本体**: 1 行目に「**何を表す型か**」を書く。どの層のものか（API レスポンス / ドメインモデル / props）も併記すると読み手が迷わない。
- **各プロパティ**: 型名から読み取れない情報を書く。特に以下は必須:
  - **単位**（`totalPages` がページ数か文字数か、`*Ms` がミリ秒か）
  - **`undefined` / 省略の意味**（「未設定」なのか「該当なし」なのか）
  - **制約・不変条件**（値域、フォーマット、他プロパティとの関係）
  - 自明なプロパティ（`id` / `title` 等）は省略してよい。**書くことがない項目に埋め草コメントを付けない**。
- **union リテラル**: 各値が**どの状態を指すか**を個別に書く。値の文字列そのものからは業務上の意味が読めない。ただし遷移ルールのように**仕様書に正がある場合は、そちらへの参照を書く**（二重管理にしない）。
- コロケーションした非 `export` の型も、意味が非自明なら同様に付ける（判断は「混乱テスト」に従う）。

`src/types/book.ts` の既存コードがこの形になっている。

```ts
/**
 * 書籍のステータス。読書前 → 読書中 ⇄ 保留 → 完読、および完読 → 読書中（再読）を遷移する。
 * 遷移ルールは docs/03-functional-specification.md 第2部を正とする。
 */
export type BookStatus = "not_started" | "reading" | "paused" | "completed";

/** 書籍1冊のドメインモデル。`local` / `supabase` の両モードで共通の論理形。 */
export interface Book {
  id: string;
  title: string;
  /** 現在ページ（絶対値）。登録直後は 0、再読開始時に 0 へリセットする。 */
  currentPage: number;
  /** 完読日時。未完読・再読中は undefined。 */
  completedAt?: string;
  /** 完読時感想。再読しても保持する（初期化しない）。 */
  reflection?: Reflection;
}
```

**`id` / `title` にコメントが無いのは正しい**。型名と項目名から意味が一意に読め、書くことがないため。

## 状態・ロジック層のコメント（カスタムフック）

カスタムフックの戻り値は、**定義ファイルを開かずに利用される**。したがって「値が何を意味するか」「関数が何を変えるか」はコメントでしか伝わらない。

> 本プロジェクトは状態管理ライブラリ（Zustand 等）・React Context を使用していない。導入する場合も本節の考え方（参照範囲で必須ラインを決める・型を先に定義する）をそのまま適用する。

### 必須ラインは「参照範囲」で決める

型定義の配置（`typescript.md`）と同じ軸を使う。

| 対象 | コメント |
|---|---|
| **ファイルを越えて使われる** — カスタムフックの戻り値、`export` された関数・型 | **必須** |
| **ファイル内に閉じる** — コンポーネント内の `useState`・ハンドラ関数・ローカル変数 | **条件付き**（「なぜ」が非自明なときのみ。「混乱テスト」に従う） |

コンポーネント内部まで一律必須にしない。`setIsOpen` に「isOpen をセットする」と書くような**埋め草が量産され、本当に重要なコメントが埋もれる**ため。

### 戻り値型を先に定義し、コメントを型側に置く

フックの戻り値を**インラインのオブジェクトリテラル**で返すと、その中身は「宣言」ではなく「式」になるため、JSDoc 規約も Lint も効かない。**戻り値型を明示**すれば、各メンバーの説明が型側に集まり、前節「型定義のコメント」の規約がそのまま効く。

`src/hooks/use-auth-session.ts` がこの形になっている。

```ts
/** useAuthSession が返す認証状態。 */
type AuthSessionState = {
  /** `supabase` モードで認証が必要かどうか。 */
  authRequired: boolean;
  /** セッション確認中かどうか（`local` モードや設定不足時は常に false）。 */
  loading: boolean;
  session: Session | null;
  isAuthenticated: boolean;
  /** Supabase Auth の環境変数不足など、設定起因のエラー文言。 */
  configError: string | null;
};

export const useAuthSession = (): AuthSessionState => {
  /* ... */
};
```

### 書くべき内容

シグネチャから読めない情報に限る。

- **その値がいつ変わるか / 誰が変えるか**（「ログアウト時にリセットされる」）
- **初期値・空値の意味**（「空配列は『0 件』であり『未取得』ではない」）
- **副作用の有無**（「この関数は API を呼ばない」）
- **他の値との関係・不変条件**（「`loading` が true の間は `session` を参照しない」）

## 混乱テスト（公開/内部・本番/テストを問わない）

判断軸は「public か否か」ではなく **「1 か月後の自分／他プロジェクト帰りの読み手が『これは何？なぜ？』となるか」**。なるなら、内部関数でもテストコードでも "why" を残す。

- **キャスト・回避策には "why" 必須**: `as unknown as` / `as any` / `@ts-ignore` / `@ts-expect-error` / マジック値 / 複雑な正規表現 / 明示的なワークアラウンド。**型を欺く・仕様を迂回する箇所は、その根拠（なぜ安全か／なぜ必要か）がコードから消える**ため、コメントが唯一の記録になる。
- **テスト足場**（SUT ビルダー・複雑な fixture・非自明な mock）も、意図が読み取りにくいなら付ける。

## 記述ルール

- **型は書かない**: 型は TypeScript のシグネチャが唯一の真実（source of truth）。JSDoc に `{string}` 等の型ブレースを併記しない（二重管理・型ずれの原因になる）。JSDoc は**意図・意味・制約**を日本語で記述する。
- **要約行必須**: 1 行目にそのシンボルが「何をするか」を簡潔に書く。
- **`@param` 必須**: 全引数に `@param name - 説明` を記述する。オプション引数・デフォルト値の意味も明記する。
- **`@returns` 必須**: 戻り値がある場合は `@returns 説明` を記述する（`void` / JSX 返却のコンポーネントは省略可）。
- **`@throws` 必須**: 意図的に例外を投げる場合は `@throws {ErrorType} 発生条件` を記述する。
- **補助タグ（任意）**: `@example` `@deprecated` `@see` は必要に応じて使う。

## 例

```ts
/**
 * ユーザー ID から表示名を解決する。キャッシュに無ければ API を叩く。
 *
 * @param userId - 対象ユーザーの UUID
 * @param opts - 解決オプション（`force` 指定でキャッシュを無視）
 * @returns 表示名。ユーザーが存在しない場合は `null`
 * @throws {ApiError} API 通信に失敗した場合
 */
export async function resolveDisplayName(
  userId: string,
  opts?: { force?: boolean },
): Promise<string | null> {
  // ...
}
```

## Lint による強制

`eslint-plugin-jsdoc` を導入済み（`front/eslint.config.mjs`・対象 `src/**/*.{ts,tsx}`・`mode: "typescript"`）。有効ルールの唯一の真実は eslint 設定ブロックとする。

- **書かれた JSDoc の妥当性を検証する**方針: `jsdoc/no-types`（型の再掲禁止）/ `jsdoc/require-param`・`require-param-description`・`check-param-names` / `jsdoc/require-returns`・`require-returns-description` を `error`、`check-alignment`・`no-multi-asterisks` を `warn`。
- `.tsx`（JSX を返すコンポーネント）は `jsdoc/require-returns` を off にする（「@returns …の要素」がノイズになるため）。`.ts`（フック / lib / API）は `@returns` 必須のまま。
- **`jsdoc/require-jsdoc` は未採用**（`//` 行コメントを誤検知するため）。したがって「公開シンボルへの JSDoc 付与」自体は lint では強制せず、ブロックの有無・質はレビューで担保する。
