import type { NextRequest } from "next/server";

/**
 * IT 用の最小リクエストダブル。Route Handler は `request.json()` しか参照せず、
 * 認証は `auth-guard` をモックして差し替えるため、ヘッダ等は不要。
 *
 * @param body - `request.json()` が返す任意の JSON 値
 * @returns NextRequest として扱える最小オブジェクト
 */
export const jsonReq = (body: unknown): NextRequest =>
  ({ json: async () => body }) as unknown as NextRequest;

/**
 * 動的ルートの `context`（`params` は Promise）を組み立てる。
 *
 * @param id - ルートパラメータの書籍 ID
 * @returns Route Handler へ渡す context
 */
export const ctx = (id: string): { params: Promise<{ id: string }> } => ({
  params: Promise.resolve({ id }),
});

/** 妥当な書籍作成ボディ。個別テストで一部を壊して準正常系を作る。 */
export const validBookBody = {
  title: "実践テスト駆動開発",
  author: "テスト太郎",
  genre: "技術書",
  format: "paper" as const,
  totalPages: 300,
  tags: ["tdd", "test"],
  status: "reading" as const,
};
