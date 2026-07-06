import "server-only";

import { PrismaClient } from "@prisma/client";

declare global {
  // グローバル宣言は var が必須（let/const は global 拡張に使えない）。
  var __prismaClient__: PrismaClient | undefined;
}

/**
 * Prisma Client のシングルトン。開発時は Next.js の HMR でモジュールが再評価されるたびに
 * 新しい接続が増えるのを防ぐため、globalThis にキャッシュして使い回す（本番では都度生成でよい）。
 */
export const prisma =
  global.__prismaClient__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prismaClient__ = prisma;
}
