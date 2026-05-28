import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BIN: string = resolve(import.meta.dir, "voila.ts");

const run = async (
  args: ReadonlyArray<string>,
  opts?: { readonly cwd?: string },
): Promise<{
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}> => {
  const proc = Bun.spawn(["bun", BIN, ...args], {
    cwd: opts?.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
};

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "voila-bin-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("voila binary (subprocess)", () => {
  test("voila list prints the M0 registry items", async () => {
    const { stdout, exitCode } = await run(["list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("admin-shell");
    expect(stdout).toContain("route/admin-splat");
    expect(stdout).toContain("server/mount");
  });

  test("voila add admin-shell --cwd <tmp> copies files", async () => {
    const { exitCode } = await run(["add", "admin-shell", "--cwd", dir]);
    expect(exitCode).toBe(0);
    expect(statSync(join(dir, "app/routes/admin/$.tsx")).isFile()).toBe(true);
    expect(statSync(join(dir, "app/server/voila.ts")).isFile()).toBe(true);
    const mount = readFileSync(join(dir, "app/server/voila.ts"), "utf8");
    expect(mount).toContain("makeHandler");
  });

  test("voila doctor exits non-zero when content.config is missing", async () => {
    const { exitCode, stdout } = await run(["doctor", "--cwd", dir]);
    expect(exitCode).not.toBe(0);
    expect(stdout).toContain("content.config");
  });
});
