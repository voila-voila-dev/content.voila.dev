import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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

describe("voila add (subprocess)", () => {
  let app: string;

  beforeEach(() => {
    app = mkdtempSync(join(tmpdir(), "voila-add-"));
  });
  afterEach(() => {
    rmSync(app, { recursive: true, force: true });
  });

  it("vends an item and its dependency-chain files into --cwd", () => {
    const result = voila("add", "admin-routes", "--cwd", app, "--no-install");
    expect(result.exitCode).toBe(0);
    // admin-routes pulls in admin-shell + content-client
    expect(existsSync(join(app, "app/routes/admin.tsx"))).toBe(true);
    expect(existsSync(join(app, "app/components/admin-layout.tsx"))).toBe(true);
    expect(existsSync(join(app, "app/lib/content-client.ts"))).toBe(true);
    expect(result.stdout).toContain("+ app/routes/admin.tsx");
  });

  it("prints the install command with --no-install instead of installing", () => {
    const result = voila("add", "content-client", "--cwd", app, "--no-install");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/add .*@voila\/content@/);
  });

  it("skips existing files unless --overwrite", () => {
    voila("add", "content-client", "--cwd", app, "--no-install");
    const dest = join(app, "app/lib/content-client.ts");
    rmSync(dest);
    Bun.write(dest, "// my edits\n");

    const skip = voila("add", "content-client", "--cwd", app, "--no-install");
    expect(skip.stdout).toContain("(exists — pass --overwrite to replace)");
    expect(readFileSync(dest, "utf8")).toBe("// my edits\n");

    const over = voila("add", "content-client", "--cwd", app, "--no-install", "--overwrite");
    expect(over.stdout).toContain("+ app/lib/content-client.ts");
    expect(readFileSync(dest, "utf8")).toContain("makeClient");
  });

  it("dry-run reports files and deps without writing", () => {
    const result = voila("add", "admin-shell", "--cwd", app, "--dry-run");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Would write:");
    expect(result.stdout).toContain("Would install:");
    expect(existsSync(join(app, "app/components/admin-layout.tsx"))).toBe(false);
  });

  it("errors on an unknown item with the catalog listed", () => {
    const result = voila("add", "nonsense", "--cwd", app, "--no-install");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('Unknown registry item "nonsense"');
  });

  it("requires at least one item", () => {
    const result = voila("add", "--cwd", app);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Usage: voila add");
  });
});
