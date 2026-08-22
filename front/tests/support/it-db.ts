import { prisma } from "@/lib/server/prisma-client";

import { assertLocalTestDatabaseUrl } from "@tests/support/test-database-url";

/**
 * IT 各ケース間で BookRecord 系テーブルを初期化する。
 * DB 状態を共有する直列実行前提のため、各 `beforeEach` で呼び出して独立性を担保する。
 * TRUNCATE ... CASCADE で進捗ログ・感想も併せて消す（外部キーで連鎖）。
 *
 * @returns 初期化完了の Promise
 * @throws {Error} 接続先がローカルの使い捨てコンテナ以外を指す場合
 */
export const resetBookRecordTables = async (): Promise<void> => {
  // TRUNCATE の直前に接続先を再検証する。globalSetup の検証はメインプロセスで 1 回きりだが、
  // 実際に破壊するのはワーカープロセスで走るこの関数だから（`.claude/rules/testing.md`）。
  assertLocalTestDatabaseUrl(process.env.DATABASE_URL, "IT テーブル初期化");

  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "BookRecordProgressLogs", "BookRecordReflections", "BookRecordBooks" RESTART IDENTITY CASCADE'
  );
};

/**
 * IT スイート終了時に Prisma 接続を破棄する。開いたままだとワーカーが終了しない。
 *
 * @returns 切断完了の Promise
 */
export const disconnectDb = async (): Promise<void> => {
  await prisma.$disconnect();
};
