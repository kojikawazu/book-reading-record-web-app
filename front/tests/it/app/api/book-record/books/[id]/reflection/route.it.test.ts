import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-guard", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/auth-guard")>();
  return { ...actual, requireAdmin: vi.fn(async () => {}) };
});

import { AuthGuardError, requireAdmin } from "@/lib/server/auth-guard";
import { disconnectDb, resetBookRecordTables } from "@tests/support/it-db";
import { ctx, jsonReq, validBookBody } from "@tests/support/it-harness";
import { POST as createBookRoute } from "@/app/api/book-record/books/route";
import { POST } from "@/app/api/book-record/books/[id]/reflection/route";
import { GET } from "@/app/api/book-record/books/[id]/route";

const authMock = vi.mocked(requireAdmin);
const MISSING_ID = "00000000-0000-0000-0000-000000000000";

const seedBook = async (): Promise<string> => {
  const res = await createBookRoute(jsonReq(validBookBody));
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

describe("IT: /api/book-record/books/[id]/reflection（実 Postgres・upsert）", () => {
  // 正常系
  it("感想を初回保存すると book に反映される", async () => {
    const id = await seedBook();
    const res = await POST(
      jsonReq({ learning: "学び", action: "次の行動", quote: "引用" }),
      ctx(id)
    );
    expect(res.status).toBe(200);

    const { book } = await res.json();
    expect(book.reflection).toMatchObject({ learning: "学び", action: "次の行動", quote: "引用" });
  });

  it("再保存は upsert で内容を上書きしつつ createdAt を維持する", async () => {
    const id = await seedBook();
    const first = await (
      await POST(jsonReq({ learning: "初版", action: "a1", quote: "q1" }), ctx(id))
    ).json();
    const createdAt = first.book.reflection.createdAt as string;
    expect(createdAt).toEqual(expect.any(String));

    const second = await (
      await POST(jsonReq({ learning: "改訂版", action: "a2", quote: "q2" }), ctx(id))
    ).json();

    // 内容は上書き、作成日時は初回のまま（採番し直さない）。
    expect(second.book.reflection).toMatchObject({ learning: "改訂版", action: "a2", quote: "q2" });
    expect(second.book.reflection.createdAt).toBe(createdAt);
  });

  it("感想保存は書籍の updatedAt を進める（一覧の並び順が updatedAt 降順のため）", async () => {
    const id = await seedBook();
    const before = (await (await GET(jsonReq({}), ctx(id))).json()).book;

    // updatedAt はミリ秒精度のため、同一ミリ秒に収まると差が出ずテストが不安定になる。
    // 実装の正否と無関係な揺れを避けるために最小限だけ待つ。
    await new Promise((resolve) => setTimeout(resolve, 10));

    const after = (
      await (
        await POST(jsonReq({ learning: "学び", action: "行動", quote: "引用" }), ctx(id))
      ).json()
    ).book;

    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(
      new Date(before.updatedAt).getTime()
    );
  });

  it("感想保存は書籍の他フィールドを変えない（updatedAt を進めるための書き戻しに副作用がない）", async () => {
    const id = await seedBook();
    const before = (await (await GET(jsonReq({}), ctx(id))).json()).book;

    await POST(jsonReq({ learning: "学び", action: "行動", quote: "引用" }), ctx(id));
    const after = (await (await GET(jsonReq({}), ctx(id))).json()).book;

    expect(after).toMatchObject({
      title: before.title,
      author: before.author,
      status: before.status,
      currentPage: before.currentPage,
      totalPages: before.totalPages,
      createdAt: before.createdAt,
    });
  });

  // 準正常系 / 異常系
  it("存在しない book への感想保存は 404", async () => {
    const res = await POST(jsonReq({ learning: "x", action: "y", quote: "z" }), ctx(MISSING_ID));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ message: "対象の書籍が見つかりません。" });
  });

  it("パース不能なボディ（learning が欠落）は 400", async () => {
    const id = await seedBook();
    const res = await POST(jsonReq({ action: "y", quote: "z" }), ctx(id));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ message: "感想保存リクエストが不正です。" });
  });

  it("未認証の感想保存は 401", async () => {
    const id = await seedBook();
    authMock.mockRejectedValueOnce(new AuthGuardError("ログインが必要です。", 401));

    const res = await POST(jsonReq({ learning: "x", action: "y", quote: "z" }), ctx(id));
    expect(res.status).toBe(401);
  });

  it("管理者以外の感想保存は 403 で DB を変更しない", async () => {
    const id = await seedBook();
    authMock.mockRejectedValueOnce(new AuthGuardError("この操作を行う権限がありません。", 403));

    const res = await POST(jsonReq({ learning: "x", action: "y", quote: "z" }), ctx(id));
    expect(res.status).toBe(403);

    const { book } = await (await GET(jsonReq({}), ctx(id))).json();
    expect(book.reflection).toBeUndefined();
  });
});
