# テスト設計: E2E 追加ケース（手動確認削減）

## 対象

- 対象機能: 既存 Case 1〜18 で未カバーのシナリオ全般 + バックログ B1〜B4 対応 E2E
- 対象ファイル: `front/e2e/book-app.spec.ts`（既存）、`front/e2e/smoke.spec.ts`（新規）、`front/e2e/backlog.spec.ts`（新規）
- スタック: Next.js / TypeScript / Playwright (local モード)
- 禁止事項: 単体テスト追加不可（`docs/03.requirements.md` §6）

---

## 現状の未カバー分析

| 既存ケース | カバー済み内容 | 未カバー |
|---|---|---|
| Case 7（週次） | ページ数・回数・感想数の数値検証 | 週次集計ゼロ状態、7日境界ぴったり |
| Case 18（stats） | ページ構造のみ | 登録書籍数・完読率の実数値 |
| Case 6（検索） | タイトルフィルタ | タグ検索・著者検索・空結果状態 |
| Case 4（完読） | 感想空入力 | 感想あり保存 → 一覧での「感想あり」扱い |
| Case 5（再読） | reflection あり書籍 | reflection なし書籍の再読 |
| Case 12（破損復旧） | 不正JSON | バージョン不一致ペイロード |
| —（スモーク） | なし | アプリ起動・主要ページ・コンソールエラー |
| —（バックログ） | なし | B1 削除 / B3 著者任意 / B4 ページ数なし完読 |

---

## テストケース一覧

### A. スモークテスト（`front/e2e/smoke.spec.ts`）

| # | テストケース | 操作 | 期待結果 | 優先度 |
|---|---|---|---|---|
| SM-1 | ダッシュボードが 200 で表示される | `goto("/")` | `dashboard-page` が visible | High |
| SM-2 | 統計ページが 200 で表示される | `goto("/stats")` | `stats-page` が visible | High |
| SM-3 | 書籍登録ページが 200 で表示される | `goto("/books/new")` | フォームが visible | High |
| SM-4 | コンソールエラーがない（主要ページ） | `goto("/")`, `goto("/stats")` | `console.error` が呼ばれない | Medium |
| SM-5 | 存在しない書籍 ID にアクセスするとトップへリダイレクト | `goto("/books/nonexistent-id")` | URL が `/` またはエラー UI が visible | Medium |

---

### B. 週次サマリー追加ケース（`book-app.spec.ts` 追記）

| # | テストケース | seed | 期待結果 | 優先度 |
|---|---|---|---|---|
| Case 7b | 週次ゼロ状態（進捗ログなし） | ログなし書籍のみ | `weekly-read-pages=0`, `weekly-progress-count=0`, `weekly-reflection-count=0` | High |
| Case 7c | 7日境界ぴったり（start日の00:00に記録） | `loggedAt = 6日前 00:00:00`（`isoDaysAgo` ではなく `new Date()` でローカル0:00を手動構築） | 集計に含まれる（= ウィンドウ内）。**注意: `isoDaysAgo` は正午固定のため境界ケースには使わず、テスト内でローカルタイムゾーンの `start.setHours(0,0,0,0)` を再現した日時を直接生成すること** | Medium |
| Case 7d | 8日前の記録は集計外 | `loggedAt = 8日前` + `loggedAt = 1日前` | 1日前分のみ集計 | Medium |

> **タイムゾーン注意**: `computeWeeklySummary` (`helpers.ts:141`) はクライアントのローカルタイムゾーンで `start = 当日0:00 - 6日` を計算する。
> `isoDaysAgo` は UTC 正午固定のため、当日や境界ぴったりのケースでは時間帯によって集計範囲が変わりうる。
> Case 7c では `isoDaysAgo` を使わず、以下のように境界日時を生成すること:
> ```ts
> const start = new Date();
> start.setHours(0, 0, 0, 0);
> start.setDate(start.getDate() - 6);
> const boundary = start.toISOString(); // ウィンドウ開始点ぴったり
> ```

---

### C. 統計レポート数値検証（`book-app.spec.ts` 追記）

> **実装メモ**: stats ページの KPI 要素（登録書籍数・完読率）に `data-testid` が設定されていないため、
> `page.getByText(...)` によるテキスト検索で検証する。

| # | テストケース | seed | 期待結果 | 優先度 |
|---|---|---|---|---|
| Case 18b | 登録書籍数・完読率が正しく表示される | 完読2冊・読書中1冊（計3冊） | `getByText("3")` が visible、`getByText("66.7%")` が visible（完読率 = `Math.round(2/3 * 1000) / 10`） | High |
| Case 18c | 書籍ゼロ状態でも stats ページがクラッシュしない | 書籍なし | `stats-page` が visible、`getByText("0%")` が visible | Medium |

---

### D. 検索追加ケース（`book-app.spec.ts` 追記）

| # | テストケース | 操作 | 期待結果 | 優先度 |
|---|---|---|---|---|
| Case 6b | 著者名で検索 | 著者 "Dweck" で検索 | 著者一致書籍のみ表示 | High |
| Case 6c | タグで検索 | タグ "rust" で検索 | タグ一致書籍のみ表示 | High |
| Case 6d | 空文字で検索クリア | 検索後に空文字入力 | 全書籍が再表示 | Medium |
| Case 6e | 一致なし → 全セクションが空 | "zzznomatch" で検索 | 読書中・読書前などが空になる | Medium |

---

### E. 完読・感想フロー補完（`book-app.spec.ts` 追記）

| # | テストケース | 操作 | 期待結果 | 優先度 |
|---|---|---|---|---|
| Case 4b | 感想3項目を入力して保存 → 感想あり扱い | 感想入力 → 保存 | `section-pending-reflection` に当該書籍が**表示されない** | High |
| Case 4c | 完読済み書籍の感想を後から編集（上書き保存） | 完読 seed → 感想再入力 → 保存 | LocalStorage の reflection が新値に更新 | High |

---

### F. 再読エッジケース（`book-app.spec.ts` 追記）

| # | テストケース | seed | 操作 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| Case 5b | reflection なし完読書籍の再読 | `reflection: undefined` | 再読ボタン押下 | `section-reading` に移動、`completedAt` が undefined | High |
| Case 5c | 再読後 `currentPage` が 0 になる | 完読 seed | 再読後 localStorage を確認 | `books[0].currentPage === 0` | High |

---

### G. 破損データ追加ケース（`book-app.spec.ts` 追記）

| # | テストケース | seed | 期待結果 | 優先度 |
|---|---|---|---|---|
| Case 12b | バージョン不一致ペイロード（version=999） | `{version:999, books:[], progressLogs:[]}` | `recovery-message` が表示、空データでダッシュボード表示 | Medium |
| Case 12c | books フィールドが配列でない | `{version:1, books:"invalid", progressLogs:[]}` | `recovery-message` が表示、クラッシュしない | Medium |

---

### H. バックログ B1〜B4 E2E（`front/e2e/backlog.spec.ts`、機能実装後に有効化）

> 以下は `test.skip()` でマークし、機能実装（B1〜B4）完了時に有効化する。

#### B1: 書籍削除（Issue #9）

| # | テストケース | 操作 | 期待結果 | 優先度 |
|---|---|---|---|---|
| B1-N1 | 書籍を削除するとダッシュボードから消える | 書籍登録 → 詳細 → 削除ボタン → 確認 | 一覧に表示されない | High |
| B1-N2 | 削除後に関連進捗ログも消える | seed（書籍+ログ） → 削除 | localStorage の `progressLogs` に当該 bookId がない | High |
| B1-S1 | 削除確認ダイアログでキャンセルすると削除されない | 削除ボタン → キャンセル | 一覧に書籍が残る | High |

#### B3: 著者任意入力（Issue #11）

| # | テストケース | 操作 | 期待結果 | 優先度 |
|---|---|---|---|---|
| B3-N1 | 著者空でも書籍登録できる | author 未入力で登録 | ダッシュボードに表示される（著者欄は空） | High |
| B3-S1 | 著者空の書籍詳細ページに著者情報なしで表示崩れない | B3-N1 後に詳細ページ | 著者欄が空または非表示でレイアウト崩れなし | Medium |

#### B4: 総ページ数未入力でも完読許可（Issue #12）

| # | テストケース | 操作 | 期待結果 | 優先度 |
|---|---|---|---|---|
| B4-N1 | 総ページ数 0 の書籍でも進捗保存で完読できる | `totalPages=0` 書籍 → ステータス=完読で保存 | `status=completed` に更新 | High |
| B4-N2 | 完読後に感想入力セクションが表示される | B4-N1 後 | `reflection` 入力欄が visible | High |
| B4-N3 | 再読ボタンが動作する | B4-N1 完読 → 再読 | `reading` に戻る | Medium |

---

## テスト構成

### スモークテスト
- テストファイル: `front/e2e/smoke.spec.ts`
- 前提条件: `local` モード（`NEXT_PUBLIC_REPOSITORY_DRIVER=local`）
- `beforeEach`: localStorage クリア（既存と同じパターン）

### 追加 E2E（既存ファイル拡張）
- テストファイル: `front/e2e/book-app.spec.ts`（末尾に追記）
- 既存の `seedStorage` / `createBookViaUi` / `isoDaysAgo` ヘルパーを再利用

### バックログ E2E
- テストファイル: `front/e2e/backlog.spec.ts`（新規）
- 実装未完のケースは `test.skip(...)` でマーク
- 機能完了時に `test.skip` → `test` に変更するだけで有効化

## モック方針

- **外部API モック**: 不要（`local` モードは localStorage のみ使用）
- **page.route**: 将来 `supabase` モードの認証・API失敗テストに使用可（今回スコープ外）
- **モック禁止**: ビジネスロジック（validate 関数 / computeWeeklySummary 等）

## 実装優先順位

1. SM-1〜SM-3（スモーク: 即効性が高い）
2. Case 4b, 4c, 5b, 5c, 6b〜6e（機能カバレッジ補完）
3. Case 7b〜7d, 18b〜18c（週次・統計数値検証）
4. Case 12b〜12c（異常系補完）
5. B1〜B4（バックログ機能実装後に有効化）
