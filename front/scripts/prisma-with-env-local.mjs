import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const ENV_FILES = [".env.local", ".env"];

const parseEnvFile = (content) => {
  const entries = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf("=");
    if (separator < 1) {
      continue;
    }

    const key = withoutExport.slice(0, separator).trim();
    let value = withoutExport.slice(separator + 1).trim();

    const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
    const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
    if (isDoubleQuoted || isSingleQuoted) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
};

const loadEnv = () => {
  const loaded = {};

  for (const path of ENV_FILES) {
    if (!existsSync(path)) {
      continue;
    }

    const parsed = parseEnvFile(readFileSync(path, "utf8"));
    Object.assign(loaded, parsed);
  }

  return loaded;
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/prisma-with-env-local.mjs <prisma-args...>");
  process.exit(1);
}

const envFromFiles = loadEnv();
const mergedEnv = { ...envFromFiles, ...process.env };
const result = spawnSync("prisma", args, {
  stdio: "inherit",
  env: mergedEnv,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
