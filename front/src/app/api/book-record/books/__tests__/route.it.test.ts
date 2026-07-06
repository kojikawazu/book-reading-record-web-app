import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// 認証境界（Supabase Auth = ネットワーク I/O）のみモックし、Prisma は実 Postgres を使う。
// AuthGuardError / isAuthGuardError は本物を残し、ルートの 401 写像を実挙動のまま検証する。
vi.mock("@/lib/server/auth-guard", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/auth-guard")>();
  return { ...actual, requireAuthenticatedUser: vi.fn(async () => {}) };
});

import { AuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import { disconnectDb, resetBookRecordTables } from "@/test/it-db";
import { jsonReq, validBookBody } from "@/test/it-harness";
import { GET, POST } from "../route";

const authMock = vi.mocked(requireAuthenticatedUser);

/**
 * POST /books を叩いて作成書籍 ID を返す（正常系ヘルパ）。
 *
 * @param overrides - validBookBody を部分的に上書きするフィールド
 * @returns 作成された書籍の ID
 */
const createBook = async (overrides: Partial<typeof validBookBody> = {}): Promise<string> => {
  const res = await POST(jsonReq({ ...validBookBody, ...overrides }));
  expect(res.status).toBe(201);
  const { book } = await res.json();
  return book.id as string;
};

beforeEach(async () => {
  authMock.mockReset();
  authMock.mockResolvedValue(undefined);
  await resetBookRecordTables();
});

afterAll(async () => {
  await disconnectDb();
});

describe("IT: /api/book-record/books（実 Postgres）", () => {
  // 正常系
  it("初期状態の GET は空配列を返す", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const { books } = await res.json();
    expect(books).toEqual([]);
  });

  it("POST で作成した書籍が実 DB に永続化され GET で取得できる", async () => {
    const id = await createBook();

    const res = await GET();
    const { books } = await res.json();
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      id,
      title: validBookBody.title,
      author: validBookBody.author,
      totalPages: 300,
      currentPage: 0,
      status: "reading",
      tags: ["tdd", "test"],
    });
  });

  it("一覧は updatedAt 降順で並ぶ（更新した書籍が先頭に来る）", async () => {
    await createBook({ title: "A" });
    await createBook({ title: "B" });
    const idC = await createBook({ title: "C" });

    // A を更新して updatedAt を最新化 → 先頭へ来ることで第一ソートキーを実 DB の ORDER BY で検証。
    const first = (await (await GET()).json()).books.find(
      (b: { title: string }) => b.title === "A"
    );
    await (
      await import("../[id]/route")
    ).PATCH(jsonReq({ author: "改訂" }), {
      params: Promise.resolve({ id: first.id }),
    });

    const { books } = await (await GET()).json();
    expect(books.map((b: { title: string }) => b.title)).toEqual(["A", "C", "B"]);
    expect(books[0].id).not.toBe(idC);
  });

  // 準正常系 / 異常系
  it("未認証の POST は 401 を返し DB を変更しない", async () => {
    authMock.mockRejectedValueOnce(new AuthGuardError("ログインが必要です。", 401));

    const res = await POST(jsonReq(validBookBody));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ message: "ログインが必要です。" });

    const { books } = await (await GET()).json();
    expect(books).toEqual([]);
  });

  it("パース不能なボディ（totalPages が文字列）は 400", async () => {
    const res = await POST(jsonReq({ ...validBookBody, totalPages: "300" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ message: "書籍作成リクエストが不正です。" });
  });

  it("リポジトリ検証違反（totalPages=0）は 400 で DB に残らない", async () => {
    const res = await POST(jsonReq({ ...validBookBody, totalPages: 0 }));
    expect(res.status).toBe(400);
    const { books } = await (await GET()).json();
    expect(books).toEqual([]);
  });
});
