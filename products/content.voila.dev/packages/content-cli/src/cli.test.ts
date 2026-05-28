import { describe, expect, test } from "bun:test";
import { BunContext } from "@effect/platform-bun";
import { Effect, Exit } from "effect";
import { cli } from "./cli.ts";

describe("cli runner", () => {
  test("--help runs without throwing", async () => {
    // `Command.run` strips the first two argv entries, so mimic the real
    // shape (`["bun", "voila", ...userArgs]`).
    const exit = await Effect.runPromiseExit(
      cli(["bun", "voila", "--help"]).pipe(Effect.provide(BunContext.layer)),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  test("list subcommand exits successfully", async () => {
    const exit = await Effect.runPromiseExit(
      cli(["bun", "voila", "list"]).pipe(Effect.provide(BunContext.layer)),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
  });
});
