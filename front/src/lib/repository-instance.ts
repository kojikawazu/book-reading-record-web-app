import { ApiRepository } from "./api-repository";
import { LocalStorageRepository } from "./local-storage-repository";
import { BookRepository } from "./repository";

/**
 * 使用するドライバーを決定する。NEXT_PUBLIC_REPOSITORY_DRIVER の明示値を最優先し、
 * 未指定なら Supabase の URL/キーが揃っている場合のみ `supabase`、なければ `local` にフォールバックする。
 *
 * @returns 選択されたドライバー名
 */
const decideDriver = (): "local" | "supabase" => {
  const forcedDriver = process.env.NEXT_PUBLIC_REPOSITORY_DRIVER;
  if (forcedDriver === "local") {
    return "local";
  }

  if (forcedDriver === "supabase") {
    return "supabase";
  }

  const hasSupabaseConfig = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return hasSupabaseConfig ? "supabase" : "local";
};

const driver = decideDriver();

/** 実行中のドライバー名。認証要否の判定（`supabase` のみ認証必須）などに使う。 */
export const repositoryDriver = driver;

/** 画面が利用する BookRepository のシングルトン。ドライバーに応じて実装が差し替わる。 */
export const repository: BookRepository =
  driver === "supabase" ? new ApiRepository() : new LocalStorageRepository();
