import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/server/prisma-client";
import { disconnectDb, resetBookRecordTables } from "@tests/support/it-db";
import { asAnonymous, asAuthenticated, disconnectRlsDb } from "@tests/support/rls-db";

/** `auth.uid()` に入れる認証済みユーザーの UUID。値そのものに意味は無い。 */
const USER_ID = "11111111-1111-1111-1111-111111111111";

/** RLS 検証用の書籍。オーナー接続で用意し、非オーナー接続から読み書きを試す。 */
const bookData = {
  title: "RLS 検証用",
  author: "テスト",
  format: "paper" as const,
  totalPages: 100,
  status: "reading" as const,
};

/**
 * オーナー接続（RLS をバイパスする）で書籍を 1 冊用意する。
 *
 * @returns 作成した書籍の ID
 */
const seedBookAsOwner = async (): Promise<string> => {
  const book = await prisma.bookRecordBook.create({ data: bookData });
  return book.id;
};

beforeEach(async () => {
  await resetBookRecordTables();
});

afterAll(async () => {
  await disconnectRlsDb();
  await disconnectDb();
});

/**
 * RLS ポリシー（`front/prisma/rls-policies.sql`）の実挙動を検証する。
 *
 * Prisma は本番でも DATABASE_URL のオーナーロールで接続するため RLS をバイパスする
 * （docs/06-security-specification.md §7.1）。したがって他の IT が全件通っても
 * ポリシーは一切検証されない。ここでは非オーナーロールで接続して防御の深度を確かめる。
 *
 * 挙動の非対称に注意する:
 * - INSERT の WITH CHECK 違反は**エラーになる**
 * - UPDATE / DELETE / SELECT はポリシーで弾かれても**エラーにならず対象 0 行になる**
 */
describe("IT: RLS ポリシー（非オーナー接続・実 Postgres）", () => {
  // --- 正常系 ---
  it("未認証でも書籍を SELECT できる（Public read）", async () => {
    await seedBookAsOwner();

    const rows = await asAnonymous((tx) => tx.bookRecordBook.findMany());

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: bookData.title });
  });

  it("認証済みなら書籍を INSERT できる", async () => {
    const created = await asAuthenticated(USER_ID, (tx) =>
      tx.bookRecordBook.create({ data: bookData })
    );

    expect(created.title).toBe(bookData.title);
  });

  it("認証済みなら書籍を UPDATE できる", async () => {
    const id = await seedBookAsOwner();

    const result = await asAuthenticated(USER_ID, (tx) =>
      tx.bookRecordBook.updateMany({ where: { id }, data: { currentPage: 42 } })
    );

    expect(result.count).toBe(1);
  });

  it("認証済みなら書籍を DELETE できる", async () => {
    const id = await seedBookAsOwner();

    const result = await asAuthenticated(USER_ID, (tx) =>
      tx.bookRecordBook.deleteMany({ where: { id } })
    );

    expect(result.count).toBe(1);
  });

  // --- 異常系: 未認証の書き込みを拒否する ---
  it("未認証の書籍 INSERT は拒否される", async () => {
    await expect(asAnonymous((tx) => tx.bookRecordBook.create({ data: bookData }))).rejects.toThrow(
      /row-level security/i
    );
  });

  it("未認証の進捗ログ INSERT は拒否される", async () => {
    const bookId = await seedBookAsOwner();

    await expect(
      asAnonymous((tx) =>
        tx.bookRecordProgressLog.create({
          data: { bookId, page: 10, memo: "", status: "reading", loggedAt: new Date() },
        })
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("未認証の感想 INSERT は拒否される", async () => {
    const bookId = await seedBookAsOwner();

    await expect(
      asAnonymous((tx) =>
        tx.bookRecordReflection.create({
          data: { bookId, learning: "学び", action: "行動", quote: "引用" },
        })
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("未認証の書籍 UPDATE はエラーにならず対象 0 行になる", async () => {
    const id = await seedBookAsOwner();

    const result = await asAnonymous((tx) =>
      tx.bookRecordBook.updateMany({ where: { id }, data: { currentPage: 42 } })
    );

    expect(result.count).toBe(0);
  });

  it("未認証の書籍 DELETE はエラーにならず対象 0 行になる", async () => {
    const id = await seedBookAsOwner();

    const result = await asAnonymous((tx) => tx.bookRecordBook.deleteMany({ where: { id } }));

    expect(result.count).toBe(0);

    // オーナー接続で確認すると、行は消えていない。
    await expect(prisma.bookRecordBook.count()).resolves.toBe(1);
  });

  it("進捗ログは認証済みでも UPDATE できない（UPDATE ポリシーが無い＝追記専用）", async () => {
    const bookId = await seedBookAsOwner();
    const log = await prisma.bookRecordProgressLog.create({
      data: { bookId, page: 10, memo: "", status: "reading", loggedAt: new Date() },
    });

    const result = await asAuthenticated(USER_ID, (tx) =>
      tx.bookRecordProgressLog.updateMany({ where: { id: log.id }, data: { page: 99 } })
    );

    // docs/05・docs/06 §7.2 の「進捗ログは追記のみで編集不可」を DB 層で担保している。
    expect(result.count).toBe(0);
  });

  // --- 前提の確認 ---
  it("オーナー接続は RLS をバイパスする（未認証相当でも書き込める）", async () => {
    // docs/06 §7.1 の記述どおりであることを確かめる。他の IT が RLS の影響を
    // 受けていないことの裏付けでもある。
    const created = await prisma.bookRecordBook.create({ data: bookData });

    expect(created.id).toEqual(expect.any(String));
  });
});
