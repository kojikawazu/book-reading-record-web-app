import { beforeEach, describe, it, expect, vi } from "vitest";
import { ApiRepository } from "../api-repository";

// Supabase クライアントは外部 I/O 境界なのでモックする。
const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));
vi.mock("../supabase/client", () => ({
  isSupabaseAuthConfigured: true,
  getSupabaseBrowserClient: () => ({ auth: { getSession: mockGetSession } }),
}));

// fetch のレスポンスを模したオブジェクトを作る。
const res = (status: number, body: unknown, jsonThrows = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => {
    if (jsonThrows) {
      throw new Error("invalid json");
    }
    return body;
  },
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { access_token: "tok" } }, error: null });
});

const repo = new ApiRepository();

describe("認証ヘッダ", () => {
  // --- 正常系 ---
  it("セッションがあれば Authorization: Bearer を付与する", async () => {
    fetchMock.mockResolvedValue(res(200, { books: [] }));
    await repo.listBooks();

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer tok");
    expect(headers.get("content-type")).toBe("application/json");
  });

  // --- 準正常系 ---
  it("未ログイン（セッションなし）では Authorization を付与しない", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    fetchMock.mockResolvedValue(res(200, { books: [] }));
    await repo.listBooks();

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("authorization")).toBeNull();
  });

  // --- 異常系 ---
  it("セッション取得エラーは専用メッセージで失敗する", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: { message: "boom" } });
    await expect(repo.listBooks()).rejects.toThrow("ログインセッションの取得に失敗しました。");
  });
});

describe("listBooks / getBook", () => {
  // --- 正常系 ---
  it("一覧のレスポンス books を返す", async () => {
    fetchMock.mockResolvedValue(res(200, { books: [{ id: "b1" }] }));
    expect(await repo.listBooks()).toEqual([{ id: "b1" }]);
  });

  it("getBook は book を返す", async () => {
    fetchMock.mockResolvedValue(res(200, { book: { id: "b1" } }));
    expect(await repo.getBook("b1")).toEqual({ id: "b1" });
  });

  // --- 準正常系 ---
  it("getBook は 404 のとき null を返す", async () => {
    fetchMock.mockResolvedValue(res(404, { message: "not found" }));
    expect(await repo.getBook("missing")).toBeNull();
  });

  // --- 異常系 ---
  it("getBook は 500 のとき例外を投げる（404 以外は握りつぶさない）", async () => {
    fetchMock.mockResolvedValue(res(500, { message: "server error" }));
    await expect(repo.getBook("b1")).rejects.toThrow("server error");
  });
});

describe("createBook", () => {
  // --- 正常系 ---
  it("genre 未指定時は空文字で送信する", async () => {
    fetchMock.mockResolvedValue(res(201, { book: { id: "b1" } }));
    await repo.createBook({
      title: "t",
      author: "a",
      format: "paper",
      totalPages: 100,
      tags: [],
      status: "not_started",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body as string).genre).toBe("");
  });
});

describe("エラーメッセージ抽出", () => {
  // --- 準正常系 ---
  it("非 2xx の message をエラーメッセージに使う", async () => {
    fetchMock.mockResolvedValue(res(400, { message: "入力が不正です。" }));
    await expect(repo.listBooks()).rejects.toThrow("入力が不正です。");
  });

  // --- 異常系 ---
  it("JSON でないエラーレスポンスは既定メッセージにフォールバックする", async () => {
    fetchMock.mockResolvedValue(res(500, null, true));
    await expect(repo.listBooks()).rejects.toThrow("データ操作に失敗しました。");
  });
});

describe("searchBooks", () => {
  // --- 正常系 ---
  it("一覧を取得してクライアント側で部分一致フィルタする", async () => {
    fetchMock.mockResolvedValue(
      res(200, {
        books: [
          { id: "1", title: "Rust", author: "K", tags: ["rust"] },
          { id: "2", title: "Go", author: "D", tags: ["go"] },
        ],
      })
    );
    const result = await repo.searchBooks("rust");
    expect(result.map((b) => b.id)).toEqual(["1"]);
  });
});
