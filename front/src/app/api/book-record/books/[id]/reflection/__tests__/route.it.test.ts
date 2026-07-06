import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth-guard", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/server/auth-guard")>();
  return { ...actual, requireAuthenticatedUser: vi.fn(async () => {}) };
});

import { AuthGuardError, requireAuthenticatedUser } from "@/lib/server/auth-guard";
import { disconnectDb, resetBookRecordTables } from "@/test/it-db";
import { ctx, jsonReq, validBookBody } from "@/test/it-harness";
import { POST as createBookRoute } from "../../../route";
import { POST } from "../route";

const authMock = vi.mocked(requireAuthenticatedUser);
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
});
