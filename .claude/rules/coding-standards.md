---
description: コーディング規約
globs: 
---

# コーディング規約

- **言語**: TypeScript strict モード（`strict: true`）
- **パッケージマネージャ**: pnpm を使用（npm, yarn は使用しない）
- **Linter / Formatter**: ESLint + Prettier でコード品質を担保
- **環境変数**: 設定値は環境変数で管理（`front/.env.local`。テンプレートは `front/.env.example`）
- **シークレット禁止**: シークレット・認証情報をハードコードしない
