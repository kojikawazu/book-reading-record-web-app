import { describe, it, expect } from "vitest";
import { findDestructiveCommand } from "@scripts/prisma-destructive-commands.mjs";

describe("findDestructiveCommand", () => {
  // --- 正常系（許可されるコマンド）---
  it.each([[["generate"]], [["db", "pull"]], [["validate"]], [["format"]]])(
    "%j は破壊的ではないと判定する",
    (args: string[]) => {
      expect(findDestructiveCommand(args)).toBeUndefined();
    }
  );

  it("引数なしは破壊的ではないと判定する", () => {
    expect(findDestructiveCommand([])).toBeUndefined();
  });

  // --- 異常系（拒否されるコマンド）---
  it.each([
    [
      ["db", "push"],
      ["db", "push"],
    ],
    [
      ["db", "push", "--accept-data-loss"],
      ["db", "push"],
    ],
    [
      ["db", "execute", "--file", "x.sql"],
      ["db", "execute"],
    ],
    [
      ["db", "seed"],
      ["db", "seed"],
    ],
    [["migrate", "dev"], ["migrate"]],
    [["migrate", "deploy"], ["migrate"]],
    [["migrate", "reset", "--force"], ["migrate"]],
  ])("%j を拒否する", (args: string[], expected: string[]) => {
    expect(findDestructiveCommand(args)).toEqual(expected);
  });

  // --- 準正常系（前置一致の境界）---
  it("db だけでは拒否しない（サブコマンドまで一致して初めて破壊的と判定する）", () => {
    expect(findDestructiveCommand(["db"])).toBeUndefined();
  });

  it("先頭以外に現れる push は拒否しない", () => {
    expect(findDestructiveCommand(["generate", "db", "push"])).toBeUndefined();
  });
});
