import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

/** Make `dir` pass the host check, with the create-voila `app/` layout. */
const makeHost = (dir: string, viteConfig = 'tanstackStart({ srcDirectory: "app" })') => {
  writeFileSync(join(dir, "package.json"), '{ "name": "host" }\n');
  writeFileSync(join(dir, "content.config.ts"), "export default { collections: {} };\n");
  writeFileSync(join(dir, "vite.config.ts"), `export default { plugins: [${viteConfig}] };\n`);
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

  it("prints its own usage for --help", () => {
    const result = voila("list", "--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("voila list");
    expect(result.stdout).toContain("--type");
  });
});

describe("voila add (subprocess)", () => {
  let app: string;

  beforeEach(() => {
    app = mkdtempSync(join(tmpdir(), "voila-add-"));
    makeHost(app);
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
    // The drift of the locally-modified file is surfaced before it's clobbered
    // (local edits show as `+` lines, matching the `voila diff` convention).
    expect(over.stdout).toContain("--overwrite will replace");
    expect(over.stdout).toContain("+ // my edits");
    expect(over.stdout).toContain("+ app/lib/content-client.ts");
    expect(readFileSync(dest, "utf8")).toContain("makeClient");
  });

  it("prints usage for --help without throwing on the flag", () => {
    const result = voila("add", "--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("voila add");
    expect(result.stdout).toContain("--overwrite");
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

  it("refuses to vend into a directory that is not a voila app", () => {
    const bare = mkdtempSync(join(tmpdir(), "voila-bare-"));
    try {
      const result = voila("add", "content-client", "--cwd", bare, "--no-install");
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("doesn't look like a voila app");
      expect(result.stderr).toContain("content.config.ts");
      expect(existsSync(join(bare, "app/lib/content-client.ts"))).toBe(false);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("refuses a --cwd that does not exist", () => {
    const result = voila("add", "content-client", "--cwd", join(app, "nope"), "--no-install");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Directory not found");
  });

  it("vends into src/ when the host's vite config says srcDirectory: src", () => {
    makeHost(app, 'tanstackStart({ srcDirectory: "src" })');
    const result = voila("add", "admin-routes", "--cwd", app, "--no-install");
    expect(result.exitCode).toBe(0);
    expect(existsSync(join(app, "src/routes/admin.tsx"))).toBe(true);
    expect(existsSync(join(app, "src/lib/content-client.ts"))).toBe(true);
    expect(existsSync(join(app, "app/routes/admin.tsx"))).toBe(false);
    expect(result.stdout).toContain("+ src/routes/admin.tsx");
  });

  it("defaults to src/ when tanstackStart() is configured without srcDirectory", () => {
    makeHost(app, "tanstackStart()");
    const result = voila("add", "content-client", "--cwd", app, "--no-install", "--dry-run");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("src/lib/content-client.ts");
  });
});

describe("voila diff (subprocess)", () => {
  let app: string;

  beforeEach(() => {
    app = mkdtempSync(join(tmpdir(), "voila-diff-cli-"));
    makeHost(app);
  });
  afterEach(() => {
    rmSync(app, { recursive: true, force: true });
  });

  it("reports missing files before anything is vended", () => {
    const result = voila("diff", "content-client", "--cwd", app);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("missing   app/lib/content-client.ts");
    expect(result.stdout).toContain("1 missing");
  });

  it("prints its own usage for --help", () => {
    const result = voila("diff", "--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("voila diff");
    expect(result.stdout).toContain("--cwd");
  });

  it("reports up to date right after add", () => {
    voila("add", "content-client", "--cwd", app, "--no-install");
    const result = voila("diff", "content-client", "--cwd", app);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Everything is up to date.");
  });

  it("shows changed lines when the local copy drifted", () => {
    voila("add", "content-client", "--cwd", app, "--no-install");
    const dest = join(app, "app/lib/content-client.ts");
    Bun.write(dest, `${readFileSync(dest, "utf8")}\n// my local tweak\n`);

    const result = voila("diff", "content-client", "--cwd", app);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("modified  app/lib/content-client.ts");
    expect(result.stdout).toContain("+ // my local tweak");
    expect(result.stdout).toContain("1 modified");
  });

  it("diffs the whole catalog when no item is named", () => {
    const result = voila("diff", "--cwd", app);
    expect(result.exitCode).toBe(0);
    // every catalog file is missing in an empty app
    expect(result.stdout).toContain("missing");
    expect(result.stdout).toContain("app/routes/admin.tsx");
  });

  it("refuses to diff against a directory that is not a voila app", () => {
    const bare = mkdtempSync(join(tmpdir(), "voila-bare-"));
    try {
      const result = voila("diff", "--cwd", bare);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("doesn't look like a voila app");
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("diffs against the host's source directory", () => {
    makeHost(app, 'tanstackStart({ srcDirectory: "src" })');
    voila("add", "content-client", "--cwd", app, "--no-install");
    const result = voila("diff", "content-client", "--cwd", app);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Everything is up to date.");
  });
});
