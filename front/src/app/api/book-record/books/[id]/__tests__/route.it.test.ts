import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-guard", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/auth-guard")>();
  return { ...actual, requireAuthenticatedUser: vi.fn(async () => {}) };
});

import { AuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import { disconnectDb, resetBookRecordTables } from "@/test/it-db";
import { ctx, jsonReq, validBookBody } from "@/test/it-harness";
import { POST as createBookRoute } from "../../route";
import { GET, PATCH } from "../route";

const authMock = vi.mocked(requireAuthenticatedUser);
const MISSING_ID = "00000000-0000-0000-0000-000000000000";

const seedBook = async (overrides: Partial<typeof validBookBody> = {}): Promise<string> => {
  const res = await createBookRoute(jsonReq({ ...validBookBody, ...overrides }));
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

describe("IT: /api/book-record/books/[id]（実 Postgres）", () => {
  // 正常系
  it("GET は該当書籍を返す", async () => {
    const id = await seedBook();
    const res = await GET(jsonReq({}), ctx(id));
    expect(res.status).toBe(200);
    const { book } = await res.json();
    expect(book).toMatchObject({ id, title: validBookBody.title });
  });

  it("PATCH でフィールドを更新でき実 DB に反映される", async () => {
    const id = await seedBook();
    const res = await PATCH(jsonReq({ title: "改題後タイトル", tags: ["updated"] }), ctx(id));
    expect(res.status).toBe(200);

    const { book } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(book.title).toBe("改題後タイトル");
    expect(book.tags).toEqual(["updated"]);
  });

  it("currentPage が総ページ以上なら completed へ自動遷移し completedAt が付与される", async () => {
    const id = await seedBook({ totalPages: 300, status: "reading" });
    const res = await PATCH(jsonReq({ currentPage: 300 }), ctx(id));
    expect(res.status).toBe(200);

    const { book } = await res.json();
    expect(book.status).toBe("completed");
    expect(book.completedAt).toEqual(expect.any(String));
  });

  // 準正常系 / 異常系
  it("存在しない ID の GET は 404", async () => {
    const res = await GET(jsonReq({}), ctx(MISSING_ID));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ message: "対象の書籍が見つかりません。" });
  });

  it("存在しない ID の PATCH は 404", async () => {
    const res = await PATCH(jsonReq({ title: "x" }), ctx(MISSING_ID));
    expect(res.status).toBe(404);
  });

  it("未認証の PATCH は 401 で DB を変更しない", async () => {
    const id = await seedBook({ title: "元タイトル" });
    authMock.mockRejectedValueOnce(new AuthGuardError("ログインが必要です。", 401));

    const res = await PATCH(jsonReq({ title: "侵入" }), ctx(id));
    expect(res.status).toBe(401);

    const { book } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(book.title).toBe("元タイトル");
  });
});
