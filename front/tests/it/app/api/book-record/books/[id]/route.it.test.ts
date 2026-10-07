import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-guard", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/auth-guard")>();
  return { ...actual, requireAdmin: vi.fn(async () => {}) };
});

import { AuthGuardError, requireAdmin } from "@/lib/server/auth-guard";
import { disconnectDb, resetBookRecordTables } from "@tests/support/it-db";
import { ctx, jsonReq, validBookBody } from "@tests/support/it-harness";
import { POST as createBookRoute } from "@/app/api/book-record/books/route";
import { DELETE, GET, PATCH } from "@/app/api/book-record/books/[id]/route";
import { POST as addProgressLogRoute } from "@/app/api/book-record/books/[id]/progress-logs/route";

const authMock = vi.mocked(requireAdmin);
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

  it("管理者以外の PATCH は 403 で DB を変更しない", async () => {
    const id = await seedBook({ title: "元タイトル" });
    authMock.mockRejectedValueOnce(new AuthGuardError("この操作を行う権限がありません。", 403));

    const res = await PATCH(jsonReq({ title: "侵入" }), ctx(id));
    expect(res.status).toBe(403);

    const { book } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(book.title).toBe("元タイトル");
  });

  // 正常系: DELETE
  it("DELETE は書籍を削除し、以降の GET が 404 になる", async () => {
    const id = await seedBook();

    const res = await DELETE(jsonReq({}), ctx(id));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id });

    expect((await GET(jsonReq({}), ctx(id))).status).toBe(404);
  });

  it("DELETE は進捗ログも消す（エンドポイント経由でのカスケード確認）", async () => {
    const id = await seedBook();
    await addProgressLogRoute(jsonReq({ page: 10, memo: "", status: "reading" }), ctx(id));

    await DELETE(jsonReq({}), ctx(id));

    // 書籍ごと消えているため、ログ取得は 404 になる。
    const res = await GET(jsonReq({}), ctx(id));
    expect(res.status).toBe(404);
  });

  // 準正常系: DELETE
  it("存在しない ID の DELETE は 404", async () => {
    const res = await DELETE(jsonReq({}), ctx(MISSING_ID));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ message: "対象の書籍が見つかりません。" });
  });

  it("未認証の DELETE は 401 で DB から消さない", async () => {
    const id = await seedBook({ title: "消されない本" });
    authMock.mockRejectedValueOnce(new AuthGuardError("ログインが必要です。", 401));

    const res = await DELETE(jsonReq({}), ctx(id));
    expect(res.status).toBe(401);

    const { book } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(book.title).toBe("消されない本");
  });

  it("管理者以外の DELETE は 403 で DB から消さない", async () => {
    const id = await seedBook({ title: "消されない本" });
    authMock.mockRejectedValueOnce(new AuthGuardError("この操作を行う権限がありません。", 403));

    const res = await DELETE(jsonReq({}), ctx(id));
    expect(res.status).toBe(403);

    const { book } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(book.title).toBe("消されない本");
  });
});
