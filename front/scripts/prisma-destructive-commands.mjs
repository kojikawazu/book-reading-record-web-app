/**
 * 本番接続先へ向けてはならない Prisma サブコマンド。
 *
 * 各要素は引数列の先頭から順に一致させる前置パターン（`["db", "push"]` は `prisma db push ...` に一致）。
 * `["migrate"]` は `migrate dev` / `migrate deploy` / `migrate reset` をまとめて拒否する。
 *
 * 根拠は `.claude/rules/database.md`（このリポジトリから db push / migrate を実行しない）と
 * `.claude/rules/production-data.md`（禁止する操作）。
 */
export const DESTRUCTIVE_PRISMA_COMMANDS = [
  ["migrate"],
  ["db", "push"],
  ["db", "execute"],
  ["db", "seed"],
];

/**
 * 引数列が破壊的サブコマンドに該当するか判定する。
 *
 * @param args - `prisma` へ渡す引数列（`process.argv.slice(2)` 相当）
 * @returns 一致した前置パターン。該当しなければ `undefined`
 */
export const findDestructiveCommand = (args) =>
  DESTRUCTIVE_PRISMA_COMMANDS.find((command) =>
    command.every((part, index) => args[index] === part)
  );
