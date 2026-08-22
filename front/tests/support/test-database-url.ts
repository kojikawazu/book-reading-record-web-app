import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * テスト DB として接続を許可するホスト。ローカルの使い捨てコンテナだけを列挙する。
 *
 * denylist（`supabase.co` 等を弾く形）にしないのは、列挙しなかったホストを素通ししてしまうため。
 * allowlist なら未知のホストは既定で拒否される（`.claude/rules/testing.md`）。
 */
const ALLOWED_HOSTS = ["localhost", "127.0.0.1", "::1"] as const;

/** `docker-compose.test.yml` が公開する使い捨て Postgres。`TEST_DATABASE_URL` 未設定時の既定値。 */
const DEFAULT_TEST_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/book_record_test?schema=public";

/** テスト DB の起動コマンド。ガード失敗時のメッセージへ復旧手順として載せる。 */
const TEST_DB_START_COMMAND = "docker compose -f docker-compose.test.yml up -d --wait";

/** テスト用の接続先を上書きする環境変数名。本番用の `DATABASE_URL` とは必ず別名にする。 */
const TEST_DATABASE_URL_KEY = "TEST_DATABASE_URL";

/** ローカル上書き用ファイル名（gitignore 対象）。存在しなくても既定値で動く。 */
const TEST_ENV_FILE_NAME = ".env.test";

/**
 * `URL#hostname` を allowlist と比較できる形へ正規化する。
 *
 * 2 点を吸収する（いずれも Node で実測した挙動）:
 * - IPv6 はブラケット付きで返る（`::1` → `"[::1]"`）
 * - `postgresql:` は WHATWG URL の special scheme ではないため opaque host 扱いになり、
 *   ホストが小文字化されない（`LOCALHOST` → `"LOCALHOST"`）
 *
 * 正規化せずに比較すると、ローカルを指しているのに allowlist を外れて落ちる。
 *
 * @param hostname - `URL#hostname` の値
 * @returns ブラケットを除去し小文字化したホスト名
 */
const normalizeHost = (hostname: string): string => hostname.replace(/^\[|\]$/g, "").toLowerCase();

/**
 * 失敗メッセージ用に接続先を `host:port` へ要約する。
 *
 * **URL 全体を出さない。** 接続 URL にはパスワードが含まれるため、そのまま出力すると
 * CI ログに認証情報が残る（`.claude/rules/error-handling.md`「センシティブ情報はログに含めない」）。
 *
 * @param rawUrl - 要約対象の接続先 URL
 * @returns `host:port` 形式の文字列。URL として解釈できない場合はその旨を示す文言
 */
const describeTarget = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    const host = normalizeHost(url.hostname);
    return url.port ? `${host}:${url.port}` : host;
  } catch {
    return "(URL として解釈できない値)";
  }
};

/** ガード失敗時に共通で添える復旧手順。原因の特定に時間をかけさせないため必ず含める。 */
const recoveryHint = (): string =>
  [
    `テスト DB を起動して再実行してください: ${TEST_DB_START_COMMAND}`,
    `既定の接続先: ${DEFAULT_TEST_DATABASE_URL}`,
    `上書きは ${TEST_DATABASE_URL_KEY} で行ってください（DATABASE_URL は参照しません）。`,
  ].join("\n");

/**
 * 接続先がローカルの使い捨て DB を指していることを検証する。
 *
 * **破壊的操作（`prisma db push` / `TRUNCATE`）の直前に呼ぶ。** テストランナーの起動時に
 * 1 回だけ検証しても、ワーカープロセスで走る破壊的操作は守れない（`.claude/rules/testing.md`）。
 *
 * @param rawUrl - 検証する接続先 URL。未設定（`undefined` / 空文字）は不正として扱う
 * @param context - 失敗メッセージの先頭に置く呼び出し元の説明（例: `IT globalSetup`）
 * @returns 検証を通った接続先 URL
 * @throws {Error} 未設定・URL として解釈不能・ホストが allowlist 外のいずれかの場合
 */
export const assertLocalTestDatabaseUrl = (rawUrl: string | undefined, context: string): string => {
  if (!rawUrl) {
    throw new Error(`${context}: テスト DB の接続先が解決できませんでした。\n${recoveryHint()}`);
  }

  let host: string;
  try {
    host = normalizeHost(new URL(rawUrl).hostname);
  } catch {
    throw new Error(
      `${context}: テスト DB の接続先を URL として解釈できませんでした` +
        `（接続先: ${describeTarget(rawUrl)}）。\n${recoveryHint()}`
    );
  }

  // readonly タプルの `includes` は引数型が要素の union に絞られて `string` を渡せないため `some` を使う。
  if (!ALLOWED_HOSTS.some((allowed) => allowed === host)) {
    throw new Error(
      `${context}: テスト DB の接続先がローカルではありません（接続先: ${describeTarget(rawUrl)}）。` +
        `許可ホスト: ${ALLOWED_HOSTS.join(" / ")}。本番 DB の破壊を防ぐため中断します。\n${recoveryHint()}`
    );
  }

  return rawUrl;
};

/**
 * `.env.test` から `TEST_DATABASE_URL` だけを取り出す。
 *
 * 汎用の dotenv パーサにしないのは、このファイルが接続先以外の設定を持つ必要がなく、
 * 読み取るキーを 1 つに絞るほど「意図しない環境変数が紛れ込む」経路が減るため。
 *
 * @param envFileDir - `.env.test` を探すディレクトリ。`undefined` ならファイルを読まない
 * @returns 見つかった値。ファイルが無い・キーが無い・値が空なら `undefined`
 */
const readTestDatabaseUrlFromFile = (envFileDir: string | undefined): string | undefined => {
  if (!envFileDir) {
    return undefined;
  }

  const file = path.resolve(envFileDir, TEST_ENV_FILE_NAME);
  if (!existsSync(file)) {
    return undefined;
  }

  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator < 1 || line.slice(0, separator).trim() !== TEST_DATABASE_URL_KEY) {
      continue;
    }

    let value = line.slice(separator + 1).trim();
    const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
    const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
    if (isDoubleQuoted || isSingleQuoted) {
      value = value.slice(1, -1);
    }

    return value || undefined;
  }

  return undefined;
};

/**
 * テスト用 DB の接続先を解決する。優先順位は
 * 環境変数 `TEST_DATABASE_URL` → `.env.test` の `TEST_DATABASE_URL` → 既定値。
 *
 * **`DATABASE_URL` は一切参照しない。** 本番用の変数を読むと、`.env` 由来の本番 URL を
 * 拾って本番を壊す経路になる（`.claude/rules/testing.md`「なぜフォールバックが危険か」）。
 *
 * @param env - 参照する環境変数の集合。テストから差し替えられるよう引数で受ける
 * @param envFileDir - `.env.test` を探すディレクトリ。省略時はファイルを読まない
 * @returns 検証を通ったテスト DB の接続先 URL
 * @throws {Error} 解決した接続先が allowlist のホストを指していない場合
 */
export const resolveTestDatabaseUrl = (
  env: Record<string, string | undefined>,
  envFileDir?: string
): string => {
  const candidate =
    env[TEST_DATABASE_URL_KEY]?.trim() ||
    readTestDatabaseUrlFromFile(envFileDir) ||
    DEFAULT_TEST_DATABASE_URL;

  return assertLocalTestDatabaseUrl(candidate, "テスト DB 接続先の解決");
};

/**
 * テスト DB の接続先を解決し、検証を通った値だけを `DATABASE_URL` へ注入する。
 *
 * Prisma Client / Prisma CLI は `DATABASE_URL` しか見ないため、**読み取って分岐するのではなく
 * 上書きして塞ぐ**。これにより、シェルや `.env` 由来の本番 URL が残らない。
 *
 * @param env - 書き込み先の環境変数オブジェクト（通常は `process.env`）
 * @param envFileDir - `.env.test` を探すディレクトリ。省略時はファイルを読まない
 * @returns 注入した接続先 URL
 * @throws {Error} 解決した接続先が allowlist のホストを指していない場合
 */
export const applyTestDatabaseUrl = (
  env: Record<string, string | undefined>,
  envFileDir?: string
): string => {
  const url = resolveTestDatabaseUrl(env, envFileDir);
  env.DATABASE_URL = url;
  return url;
};
