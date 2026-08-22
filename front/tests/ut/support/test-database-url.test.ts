import { describe, it, expect } from "vitest";
import {
  applyTestDatabaseUrl,
  assertLocalTestDatabaseUrl,
  resolveTestDatabaseUrl,
} from "@tests/support/test-database-url";

/** `docker-compose.test.yml` の使い捨てコンテナを指す既定値。実装と同じ値を明示的に書き下す。 */
const DEFAULT_URL = "postgresql://postgres:postgres@localhost:5433/book_record_test?schema=public";

/** 本番相当の接続先。ガードが確実に弾くことを確認するためのダミー（実在しない project-ref）。 */
const PRODUCTION_URL = "postgresql://postgres:dummy-password@db.abcdefgh.supabase.co:5432/postgres";

describe("resolveTestDatabaseUrl", () => {
  // --- 正常系 ---
  it("環境変数も .env.test も無ければ既定のローカルコンテナを返す", () => {
    expect(resolveTestDatabaseUrl({})).toBe(DEFAULT_URL);
  });

  it("TEST_DATABASE_URL の指定を採用する", () => {
    const url = "postgresql://postgres:postgres@localhost:6000/other_test";
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: url })).toBe(url);
  });

  // --- 準正常系 ---
  it("DATABASE_URL が本番で汚染されていても無視して既定値を返す", () => {
    expect(resolveTestDatabaseUrl({ DATABASE_URL: PRODUCTION_URL })).toBe(DEFAULT_URL);
  });

  it("TEST_DATABASE_URL が空白のみなら既定値へフォールバックする", () => {
    expect(resolveTestDatabaseUrl({ TEST_DATABASE_URL: "   " })).toBe(DEFAULT_URL);
  });

  // --- 異常系 ---
  it("TEST_DATABASE_URL がリモートホストなら解決時点で throw する", () => {
    expect(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: PRODUCTION_URL })).toThrow(
      /ローカルではありません/
    );
  });
});

describe("assertLocalTestDatabaseUrl", () => {
  // --- 正常系 ---
  it.each([
    ["localhost", "postgresql://postgres:postgres@localhost:5433/db"],
    ["127.0.0.1", "postgresql://postgres:postgres@127.0.0.1:5433/db"],
    ["IPv6 の ::1（ブラケット付きで返る）", "postgresql://postgres:postgres@[::1]:5433/db"],
    [
      "大文字ホスト（postgresql は小文字化されない）",
      "postgresql://postgres:postgres@LOCALHOST:5433/db",
    ],
  ])("%s を許可する", (_label, url) => {
    expect(assertLocalTestDatabaseUrl(url, "UT")).toBe(url);
  });

  // --- 準正常系 ---
  it("ポート指定が無いローカル URL も許可する（allowlist はホストのみで判定する）", () => {
    const url = "postgres://postgres:postgres@localhost/db";
    expect(assertLocalTestDatabaseUrl(url, "UT")).toBe(url);
  });

  // --- 異常系 ---
  it("未設定なら throw する", () => {
    expect(() => assertLocalTestDatabaseUrl(undefined, "UT")).toThrow(
      /接続先が解決できませんでした/
    );
  });

  it("空文字なら throw する", () => {
    expect(() => assertLocalTestDatabaseUrl("", "UT")).toThrow(/接続先が解決できませんでした/);
  });

  it("URL として解釈できない値なら throw する", () => {
    expect(() => assertLocalTestDatabaseUrl("not-a-url", "UT")).toThrow(
      /URL として解釈できませんでした/
    );
  });

  it("リモートホストを拒否する", () => {
    expect(() => assertLocalTestDatabaseUrl(PRODUCTION_URL, "UT")).toThrow(
      /ローカルではありません/
    );
  });

  it("フラグメントで localhost を装った URL を拒否する", () => {
    // WHATWG URL は hostname を evil.com と解釈する。denylist だと見た目に騙される余地がある。
    expect(() =>
      assertLocalTestDatabaseUrl("postgresql://user:pw@evil.com#@localhost/db", "UT")
    ).toThrow(/ローカルではありません/);
  });
});

describe("assertLocalTestDatabaseUrl の失敗メッセージ", () => {
  // --- 正常系 ---
  it("呼び出し元・接続先ホスト・復旧手順・既定 URL を含む", () => {
    let message = "";
    try {
      assertLocalTestDatabaseUrl(PRODUCTION_URL, "IT テーブル初期化");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain("IT テーブル初期化");
    expect(message).toContain("db.abcdefgh.supabase.co:5432");
    expect(message).toContain("docker compose -f docker-compose.test.yml up -d --wait");
    expect(message).toContain(DEFAULT_URL);
    expect(message).toContain("TEST_DATABASE_URL");
  });

  // --- 異常系（漏洩防止）---
  it("接続先 URL のパスワードを含まない", () => {
    let message = "";
    try {
      assertLocalTestDatabaseUrl(PRODUCTION_URL, "UT");
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).not.toContain("dummy-password");
  });
});

describe("applyTestDatabaseUrl", () => {
  // --- 正常系 ---
  it("検証済みの接続先を DATABASE_URL へ注入して返す", () => {
    const env: Record<string, string | undefined> = {};
    expect(applyTestDatabaseUrl(env)).toBe(DEFAULT_URL);
    expect(env.DATABASE_URL).toBe(DEFAULT_URL);
  });

  // --- 準正常系 ---
  it("既存の DATABASE_URL（本番）を検証済みの値で上書きする", () => {
    const env: Record<string, string | undefined> = { DATABASE_URL: PRODUCTION_URL };
    applyTestDatabaseUrl(env);
    expect(env.DATABASE_URL).toBe(DEFAULT_URL);
  });

  // --- 異常系 ---
  it("リモートを指す TEST_DATABASE_URL では throw し、DATABASE_URL を書き換えない", () => {
    const env: Record<string, string | undefined> = {
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/db",
      TEST_DATABASE_URL: PRODUCTION_URL,
    };
    expect(() => applyTestDatabaseUrl(env)).toThrow(/ローカルではありません/);
    expect(env.DATABASE_URL).toBe("postgresql://postgres:postgres@localhost:5433/db");
  });
});
