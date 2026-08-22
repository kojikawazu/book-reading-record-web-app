import { Prisma, PrismaClient } from "@prisma/client";

import { assertLocalTestDatabaseUrl } from "@tests/support/test-database-url";

/**
 * RLS を観測するための非オーナーロール。`tests/support/rls-test-setup.sql` が作る。
 * 使い捨てコンテナ限定の固定値でありシークレットではない。
 */
const RLS_ROLE = "rls_tester";

/**
 * 検証済みのテスト DB 接続先から、非オーナーロール用の接続 URL を組み立てる。
 *
 * **オーナー（postgres）で接続すると RLS がバイパスされ、ポリシーが 1 行も効かない。**
 * 本番で Prisma が RLS をバイパスするのと同じ理由（docs/06-security-specification.md §7.1）。
 *
 * ホストは元の URL から引き継ぐため、allowlist の保証もそのまま維持される。
 * 組み立て後にもう一度検証して、ホストが変わっていないことを機械的に確かめる。
 *
 * @returns `rls_tester` ロールで接続する URL
 * @throws {Error} 元の接続先、または組み立て結果がローカル以外を指す場合
 */
const buildRlsDatabaseUrl = (): string => {
  const base = assertLocalTestDatabaseUrl(process.env.DATABASE_URL, "RLS IT");
  const url = new URL(base);
  const rebuilt = `postgresql://${RLS_ROLE}:${RLS_ROLE}@${url.host}${url.pathname}${url.search}`;

  return assertLocalTestDatabaseUrl(rebuilt, "RLS IT");
};

/** 非オーナーロールで接続する Prisma Client。RLS ポリシーの適用対象になる。 */
export const rlsPrisma = new PrismaClient({ datasourceUrl: buildRlsDatabaseUrl() });

/**
 * JWT クレームを設定したトランザクション内でクエリを実行する。
 *
 * `set_config(..., true)` はトランザクションローカルのため、必ず対話的トランザクションで囲う。
 *
 * @param claims - `request.jwt.claims` に設定する JSON 文字列。空文字は未認証を表す
 * @param run - トランザクションクライアントを受け取る処理
 * @returns `run` の戻り値
 */
const withClaims = <T>(
  claims: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> =>
  rlsPrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("select set_config('request.jwt.claims', $1, true)", claims);
    return run(tx);
  });

/**
 * 未認証（`auth.uid()` が null）としてクエリを実行する。
 *
 * @param run - トランザクションクライアントを受け取る処理
 * @returns `run` の戻り値
 */
export const asAnonymous = <T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  withClaims("", run);

/**
 * 認証済み（`auth.uid()` が非 null）としてクエリを実行する。
 *
 * @param userId - `sub` クレームに入れる UUID
 * @param run - トランザクションクライアントを受け取る処理
 * @returns `run` の戻り値
 */
export const asAuthenticated = <T>(
  userId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> => withClaims(JSON.stringify({ sub: userId }), run);

/**
 * RLS 用クライアントの接続を破棄する。開いたままだとワーカーが終了しない。
 *
 * @returns 切断完了の Promise
 */
export const disconnectRlsDb = async (): Promise<void> => {
  await rlsPrisma.$disconnect();
};
