import { afterEach, describe, expect, it, vi } from "vitest";

const SUPABASE_URL = "https://example-ref.supabase.co";
// 強制モードのヘッダー名（#109）。Report-Only（観測モード）に戻っていないことも併せて検証する。
const CSP_HEADER = "Content-Security-Policy";

// next.config.ts は import 時に NEXT_PUBLIC_SUPABASE_URL を読むため、env を切り替えて再読み込みする。
// undefined を渡すと未設定（local モードや CI のビルド）を再現する。
const loadHeaders = async (supabaseUrl: string | undefined) => {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (supabaseUrl === undefined) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  } else {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
  }
  // next.config.ts は src/ の外（front/ 直下）にあり @/ エイリアスで指せないため、ここだけ相対パスで読む。
  const { default: config } = await import("../../next.config");
  if (!config.headers) {
    throw new Error("next.config.ts に headers() が定義されていない");
  }
  const rules = await config.headers();
  return rules;
};

// 指定ルールのヘッダーを key → value の辞書にする。
const toMap = (headers: { key: string; value: string }[]) =>
  Object.fromEntries(headers.map((h) => [h.key, h.value]));

// CSP 文字列を「ディレクティブ名 → 値」の辞書にする（順序に依存せず検証するため）。
const parseCsp = (csp: string) =>
  Object.fromEntries(
    csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values.join(" ")];
    })
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config.ts headers()", () => {
  // --- 正常系 ---
  it("全パスに 5 種類のセキュリティヘッダーを付与する", async () => {
    const rules = await loadHeaders(SUPABASE_URL);

    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe("/:path*");
    expect(toMap(rules[0]?.headers ?? [])).toEqual({
      [CSP_HEADER]: expect.any(String),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("connect-src に Supabase のオリジンを含める", async () => {
    const rules = await loadHeaders(SUPABASE_URL);
    const csp = parseCsp(toMap(rules[0]?.headers ?? [])[CSP_HEADER]!);

    expect(csp["connect-src"]).toBe(`'self' ${SUPABASE_URL}`);
  });

  it("CSP を Report-Only ではなく強制モードで付与する", async () => {
    const rules = await loadHeaders(SUPABASE_URL);
    const headers = toMap(rules[0]?.headers ?? []);

    expect(headers[CSP_HEADER]).toContain("default-src 'self'");
    expect(headers).not.toHaveProperty("Content-Security-Policy-Report-Only");
  });

  // --- 準正常系 ---
  it("Supabase の URL が未設定でも connect-src は 'self' だけになり、文字列が壊れない", async () => {
    const rules = await loadHeaders(undefined);
    const raw = toMap(rules[0]?.headers ?? [])[CSP_HEADER]!;

    expect(parseCsp(raw)["connect-src"]).toBe("'self'");
    expect(raw).not.toContain("undefined");
    expect(raw).not.toMatch(/\s;/);
  });

  it("外部リソースを広く許可するワイルドカードを含めない", async () => {
    const rules = await loadHeaders(SUPABASE_URL);
    const csp = parseCsp(toMap(rules[0]?.headers ?? [])[CSP_HEADER]!);

    for (const [name, value] of Object.entries(csp)) {
      expect(value, name).not.toMatch(/(^|\s)(\*|https:|http:)(\s|$)/);
    }
  });

  it("script-src に 'unsafe-eval' を許可しない", async () => {
    const rules = await loadHeaders(SUPABASE_URL);
    const csp = parseCsp(toMap(rules[0]?.headers ?? [])[CSP_HEADER]!);

    expect(csp["script-src"]).toBe("'self' 'unsafe-inline'");
  });

  it("フレーム埋め込み・プラグイン・base 書き換えを禁止する", async () => {
    const rules = await loadHeaders(SUPABASE_URL);
    const csp = parseCsp(toMap(rules[0]?.headers ?? [])[CSP_HEADER]!);

    expect(csp["frame-ancestors"]).toBe("'none'");
    expect(csp["object-src"]).toBe("'none'");
    expect(csp["base-uri"]).toBe("'self'");
    expect(csp["form-action"]).toBe("'self'");
  });
});
