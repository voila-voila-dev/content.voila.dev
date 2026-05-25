import { describe, expect, test } from "bun:test";
import { run } from "./run.ts";

function captureIo() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) },
  };
}

describe("run / parseFlags", () => {
  test("rejects a flag that is followed by another flag instead of a value", async () => {
    const { err, io } = captureIo();
    const code = await run(["migrate", "generate", "--name", "--dialect", "sqlite"], io);
    expect(code).toBe(1);
    expect(err.join("\n")).toMatch(/flag --name requires a value/);
  });

  test("rejects a flag that is the last argv with no value", async () => {
    const { err, io } = captureIo();
    const code = await run(["migrate", "apply", "--db"], io);
    expect(code).toBe(1);
    expect(err.join("\n")).toMatch(/flag --db requires a value/);
  });

  test("rejects positional arguments", async () => {
    const { err, io } = captureIo();
    const code = await run(["migrate", "generate", "stray-positional"], io);
    expect(code).toBe(1);
    expect(err.join("\n")).toMatch(/unexpected positional argument: stray-positional/);
  });

  test("accepts --key=value form", async () => {
    const { err, io } = captureIo();
    const code = await run(["migrate", "apply", "--target=sqlite", "--db=:memory:"], io);
    // Will succeed at flag parsing; downstream may still fail because no
    // migrations dir exists in cwd — we only assert no parse-time error.
    expect(err.join("\n")).not.toMatch(/requires a value/);
    expect(err.join("\n")).not.toMatch(/unexpected positional/);
    // It either ran (returning 0) or errored downstream — both acceptable.
    expect([0, 1]).toContain(code);
  });

  test("prints usage for --help", async () => {
    const { out, io } = captureIo();
    const code = await run(["--help"], io);
    expect(code).toBe(0);
    expect(out.join("\n")).toMatch(/voila migrate/);
    expect(out.join("\n")).toMatch(/voila seed admin/);
  });

  test("seed admin: rejects an unknown --target", async () => {
    const { err, io } = captureIo();
    const code = await run(["seed", "admin", "--email", "a@b", "--target", "weird"], io);
    expect(code).toBe(1);
    expect(err.join("\n")).toMatch(/unknown --target: weird/);
  });

  test("seed admin: requires --email", async () => {
    const { err, io } = captureIo();
    const code = await run(["seed", "admin", "--target", "sqlite", "--db", ":memory:"], io);
    expect(code).toBe(1);
    expect(err.join("\n")).toMatch(/--email is required/);
  });
});
