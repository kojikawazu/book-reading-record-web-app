import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-guard", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/auth-guard")>();
  return { ...actual, requireAuthenticatedUser: vi.fn(async () => {}) };
});

import { AuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import { disconnectDb, resetBookRecordTables } from "@/test/it-db";
import { ctx, jsonReq, validBookBody } from "@/test/it-harness";
import { POST as createBookRoute } from "../../../route";
import { GET as getBook } from "../../route";
import { GET, POST } from "../route";

const authMock = vi.mocked(requireAuthenticatedUser);
const MISSING_ID = "00000000-0000-0000-0000-000000000000";

const seedBook = async (overrides: Partial<typeof validBookBody> = {}): Promise<string> => {
  const res = await createBookRoute(jsonReq({ ...validBookBody, totalPages: 1000, ...overrides }));
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

describe("IT: /api/book-record/books/[id]/progress-logs（実 Postgres・$transaction）", () => {
  // 正常系: $transaction が book 更新と log 追加を原子的に確定する
  it("進捗登録で book.currentPage 更新と log 追加が両方コミットされる", async () => {
    const id = await seedBook();

    const res = await POST(jsonReq({ page: 150, memo: "第3章まで", status: "reading" }), ctx(id));
    expect(res.status).toBe(201);

    const { book } = await (await getBook(jsonReq({}), ctx(id))).json();
    expect(book.currentPage).toBe(150);

    const { logs } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ page: 150, memo: "第3章まで", status: "reading" });
  });

  it("到達ページが総ページ以上なら completed へ自動遷移する", async () => {
    const id = await seedBook({ totalPages: 200 });
    const res = await POST(jsonReq({ page: 200, memo: "", status: "reading" }), ctx(id));
    expect(res.status).toBe(201);

    const { book } = await (await getBook(jsonReq({}), ctx(id))).json();
    expect(book.status).toBe("completed");
    expect(book.completedAt).toEqual(expect.any(String));
  });

  it("進捗履歴は loggedAt 降順で返る", async () => {
    const id = await seedBook();
    await POST(jsonReq({ page: 10, memo: "", status: "reading", loggedAt: "2024-01-01T00:00:00.000Z" }), ctx(id)); // prettier-ignore
    await POST(jsonReq({ page: 30, memo: "", status: "reading", loggedAt: "2024-01-03T00:00:00.000Z" }), ctx(id)); // prettier-ignore
    await POST(jsonReq({ page: 20, memo: "", status: "reading", loggedAt: "2024-01-02T00:00:00.000Z" }), ctx(id)); // prettier-ignore

    const { logs } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(logs.map((l: { page: number }) => l.page)).toEqual([30, 20, 10]);
  });

  // 準正常系 / 異常系: 失敗時に部分書き込みが残らない（原子性の裏面）
  it("存在しない book への進捗登録は 404 で log を作らない", async () => {
    const res = await POST(jsonReq({ page: 10, memo: "", status: "reading" }), ctx(MISSING_ID));
    expect(res.status).toBe(404);

    const { logs } = await (await GET(jsonReq({}), ctx(MISSING_ID))).json();
    expect(logs).toEqual([]);
  });

  it("完読条件未達で completed 指定 → 400・log 無し・currentPage 不変", async () => {
    const id = await seedBook({ totalPages: 1000 });

    const res = await POST(jsonReq({ page: 50, memo: "", status: "completed" }), ctx(id));
    expect(res.status).toBe(400);

    const { book } = await (await getBook(jsonReq({}), ctx(id))).json();
    expect(book.currentPage).toBe(0);
    const { logs } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(logs).toEqual([]);
  });

  it("未認証の進捗登録は 401", async () => {
    const id = await seedBook();
    authMock.mockRejectedValueOnce(new AuthGuardError("ログインが必要です。", 401));

    const res = await POST(jsonReq({ page: 10, memo: "", status: "reading" }), ctx(id));
    expect(res.status).toBe(401);

    const { logs } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(logs).toEqual([]);
  });
});
