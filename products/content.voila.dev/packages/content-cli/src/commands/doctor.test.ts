import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunContext } from "@effect/platform-bun";
import { Cause, Effect, Exit } from "effect";
import { DoctorFailed, doctorProgram, runChecks } from "./doctor.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "voila-doctor-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runChecks", () => {
  test("reports OK when content.config.ts exists", async () => {
    writeFileSync(join(dir, "content.config.ts"), "export default {}\n");
    const results = await Effect.runPromise(runChecks(dir).pipe(Effect.provide(BunContext.layer)));
    const config = results.find((r) => r.name === "content.config");
    expect(config?.ok).toBe(true);
    expect(config?.detail).toContain("content.config.ts");
  });

  test("reports missing content.config", async () => {
    const results = await Effect.runPromise(runChecks(dir).pipe(Effect.provide(BunContext.layer)));
    const config = results.find((r) => r.name === "content.config");
    expect(config?.ok).toBe(false);
    expect(config?.detail).toContain("missing");
  });

  test("finds .js variant", async () => {
    writeFileSync(join(dir, "content.config.js"), "module.exports = {}\n");
    const results = await Effect.runPromise(runChecks(dir).pipe(Effect.provide(BunContext.layer)));
    expect(results.find((r) => r.name === "content.config")?.ok).toBe(true);
  });

  test("reports effect installed", async () => {
    const results = await Effect.runPromise(runChecks(dir).pipe(Effect.provide(BunContext.layer)));
    expect(results.find((r) => r.name === "effect")?.ok).toBe(true);
  });
});

describe("doctorProgram exit", () => {
  test("fails with DoctorFailed when config is missing", async () => {
    const exit = await Effect.runPromiseExit(
      doctorProgram(dir).pipe(Effect.provide(BunContext.layer)),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(DoctorFailed);
      }
    }
  });

  test("succeeds when config is present", async () => {
    // Ensure the parent dir for the config file exists (it does — `dir` is the tmpdir itself).
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "content.config.ts"), "export default {}\n");
    const exit = await Effect.runPromiseExit(
      doctorProgram(dir).pipe(Effect.provide(BunContext.layer)),
    );
    expect(Exit.isSuccess(exit)).toBe(true);
  });
});
