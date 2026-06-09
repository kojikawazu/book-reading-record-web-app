# 非機能仕様書（Non-Functional Specification）

パフォーマンス・ユーザビリティ・可用性・保守性などの非機能要件を定義する。

## 1. 非機能要件

- モバイル優先UI
- ローカル開発環境で即起動可能
- Repositoryドライバー切替で同一UIから `supabase` / `local` の両方を利用可能
- `base/` は read-only
- 実装は `front/` のみ

## 2. ユーザビリティ / 性能目標

- 進捗入力は30秒以内で完了できることを目標とする。
- モバイルで片手入力できるフォーム密度を維持する。
- エラーメッセージは入力項目の直下に表示する。
- UI 詳細は `docs/03-functional-specification.md` 第1部 §4 を参照。

## 3. 信頼性 / データ保全

- `local` モードでデータ破損（JSON parse 失敗等）を検知した場合でも、アプリ全体をクラッシュさせない。
  - 破損データはバックアップへ退避し、初期値で再初期化する。
  - 詳細は `docs/05-data-specification.md` §5・§6 を参照。

## 4. 移植性 / 構成切替

- `NEXT_PUBLIC_REPOSITORY_DRIVER` により `supabase`（通常運用）/ `local`（E2E・ローカル受け入れ）を切り替え可能とする。
- 切替後も `Book` / `ProgressLog` / `Reflection` の論理モデルは維持する。
