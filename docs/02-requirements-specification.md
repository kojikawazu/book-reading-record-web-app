# 要件仕様書（Requirements Specification）

MVP の機能要件一覧・受け入れ条件・優先度を定義する。プロジェクト背景・スコープは `docs/01-business-requirements.md` を参照する。

## 1. 機能要件（MVP必須）

1. 書籍登録
- タイトル、著者、読書形式、総ページ数、初期ステータスを登録できる

2. 進捗記録
- 書籍ごとに現在ページを直接入力で更新できる
- 記録時にメモを残せる
- 記録時にステータスを更新できる

3. 完読時感想
- 完読時のみ感想入力セクションを表示する
- 学び/行動/一文を保存できる（空入力可）
- 学び/行動/一文がすべて空文字の場合は「感想未記入」として扱う

4. ダッシュボード
- 読書前、読書中、保留、完読、感想未記入を一覧表示

5. 検索
- タイトル・著者・タグで検索できる

6. 週次可視化
- 直近7日（当日を含む）の読了ページ数、進捗記録回数、感想数を表示

7. 統計レポート画面
- `/stats` で登録書籍数、完読率、ステータス分布、読書形式分布を表示できる
- 集計データは現在のRepositoryドライバー（`supabase` / `local`）から算出する

8. 認証
- `/auth/login` からGoogle OAuthでログインできる
- `supabase` モード時、閲覧系（ホーム `/`・統計 `/stats` で利用する取得処理）は未ログインでも利用できる
- `supabase` モード時、更新系（書籍登録・進捗記録・感想保存・再読）は認証済みユーザーのみ利用できる

## 2. 受け入れ条件

- 受け入れ E2E ケース（Case 1-18）を満たすこと。詳細は `docs/08-test-specification.md` を参照する。

## 3. 詳細仕様マップ（分割管理）

- UI/UX・業務ルール（状態遷移・集計・並び順）: `docs/03-functional-specification.md`
- 非機能要件: `docs/04-non-functional-specification.md`
- データモデル/保存仕様: `docs/05-data-specification.md`
- セキュリティ/入力検証/認証/RLS: `docs/06-security-specification.md`
- API/Repository 契約: `docs/07-api-specification.md`
- テスト仕様（受け入れE2Eケース含む）: `docs/08-test-specification.md`
- アーキテクチャ/技術スタック/デプロイ: `docs/09-architecture-specification.md`
- 実装タスク/体制/進行フロー: `docs/11-tasks.md`

## 4. 優先順位（矛盾時）

- `docs/08-test-specification.md`（受け入れE2Eケース）> `docs/02-requirements-specification.md`（本書）> `docs/03-functional-specification.md`
- `docs/04`〜`docs/07`・`docs/09` は本書の詳細分割として扱う
- 詳細分割ドキュメント間で矛盾がある場合は、本書（要件仕様書）を優先する
