import { describe, expect, it } from "bun:test";
import { join } from "node:path";

const binPath = join(import.meta.dir, "bin.ts");
const cwd = join(import.meta.dir, "..", "..");

const voila = (...args: Array<string>) => {
  const proc = Bun.spawnSync({ cmd: ["bun", binPath, ...args], cwd });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
};

describe("voila list (subprocess)", () => {
  it("lists the catalog grouped by type", () => {
    const result = voila("list");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("shell:");
    expect(result.stdout).toContain("admin-shell");
    expect(result.stdout).toContain("Typed content client");
  });

  it("scopes the listing with --type", () => {
    const result = voila("list", "--type", "shell");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("admin-shell");
    expect(result.stdout).not.toContain("admin-routes");
  });

  it("rejects an unknown --type", () => {
    const result = voila("list", "--type", "bogus");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Invalid --type "bogus"');
  });

  it("is advertised in the top-level help", () => {
    const result = voila("--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("list");
    expect(result.stdout).toContain("Browse the registry catalog");
  });
});
