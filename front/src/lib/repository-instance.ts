import { ApiRepository } from "./api-repository";
import { LocalStorageRepository } from "./local-storage-repository";
import { BookRepository } from "./repository";

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

export const repositoryDriver = driver;

export const repository: BookRepository =
  driver === "supabase" ? new ApiRepository() : new LocalStorageRepository();
