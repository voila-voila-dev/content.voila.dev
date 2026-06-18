import { Database } from "bun:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const binPath = join(import.meta.dir, "bin.ts");

// Temp dir lives under the package so the spawned process resolves the
// `@voila/content` workspace import from the repo's node_modules.
const tmpRoot = join(import.meta.dir, "..", "..");

const CONFIG = `import { defineCollection, defineConfig, fields } from "@voila/content";

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  fields: {
    title: fields.string({ min: 1, required: true }),
    published: fields.boolean({ defaultValue: false }),
  },
});

export default defineConfig({ branding: { name: "CLI Test" }, collections: { posts } });
`;

const voila = (cwd: string, ...args: Array<string>) => {
  const proc = Bun.spawnSync({ cmd: ["bun", binPath, ...args], cwd });
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
};

describe("voila migrate --help", () => {
  it("prints usage for generate without throwing on the flag", () => {
    const result = voila(tmpRoot, "migrate", "generate", "--help");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("voila migrate generate");
    expect(result.stdout).toContain("--dialect");
  });

  it("prints usage for apply", () => {
    const result = voila(tmpRoot, "migrate", "apply", "-h");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("voila migrate apply");
    expect(result.stdout).toContain("--target");
  });
});

describe("voila migrate (subprocess)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpRoot, ".test-tmp-cli-"));
    writeFileSync(join(dir, "content.config.ts"), CONFIG);
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("generate writes a migration derived from content.config.ts", () => {
    const result = voila(dir, "migrate", "generate", "--name", "init");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Created migrations/0001_init.sql");
  });

  it("apply creates the schema and is idempotent", () => {
    const first = voila(dir, "migrate", "apply", "--db", "file:./local.db");
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toContain("Applied 1 migration(s): 1_init");

    const db = new Database(join(dir, "local.db"));
    try {
      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r) => (r as { name: string }).name);
      expect(tables).toContain("posts");
    } finally {
      db.close();
    }

    const second = voila(dir, "migrate", "apply", "--db", "file:./local.db");
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("Already up to date.");
  });
});
