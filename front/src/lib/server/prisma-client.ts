import "server-only";

import { PrismaClient } from "@prisma/client";

declare global {
  var __prismaClient__: PrismaClient | undefined;
}

export const prisma =
  global.__prismaClient__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prismaClient__ = prisma;
}
