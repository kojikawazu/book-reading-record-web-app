import type { NextConfig } from "next";

// Supabase への接続先。`connect-src` で明示的に許可しないと認証・データ取得がすべて止まる。
// local モードや CI のように未設定のビルドでも CSP の文字列が壊れないよう、空文字を許容する。
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/**
 * Content-Security-Policy のディレクティブ。各値の理由は docs/06-security-specification.md
 * 「セキュリティヘッダー」を正とする。
 *
 * `script-src` / `style-src` の `'unsafe-inline'` は、Next.js のハイドレーション用インライン
 * スクリプトと Tailwind のインラインスタイルのため。nonce 方式は middleware の新設を伴うため見送る。
 */
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
].join("; ");

const nextConfig: NextConfig = {
  /**
   * 全レスポンスに付与するセキュリティヘッダー。
   *
   * CSP は #104 で Report-Only（違反を報告するだけでブロックしない観測モード）として導入した。
   * 本番で違反 0 件を観測したうえで、#109 で強制モード（`Content-Security-Policy`）へ切り替える。
   *
   * @returns ヘッダー適用ルールの配列
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  reactCompiler: true,
};

export default nextConfig;
