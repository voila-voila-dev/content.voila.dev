import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { migrateGenerate } from "./migrate-generate.ts";

// Tests anchor temp dirs under the package directory so Bun + drizzle-kit
// can resolve `@voila/content` / `@voila/content-schema` /
// `@voila/content-database` via the workspace's hoisted node_modules.
const ROOT = resolve(import.meta.dir, "..", "..", ".tmp-generate");
const dirs: string[] = [];

function tmpDir(): string {
  mkdirSync(ROOT, { recursive: true });
  const d = mkdtempSync(join(ROOT, "case-"));
  dirs.push(d);
  return d;
}

function writeConfig(cwd: string, body: string): void {
  writeFileSync(join(cwd, "content.config.ts"), body);
}

const POSTS_CONFIG = `import { defineCollection, defineContent } from "@voila/content";
import { fields } from "@voila/content-schema";

export default defineContent({
  collections: [
    defineCollection({
      slug: "posts",
      fields: {
        title: fields.string({ required: true }),
        slug: fields.string({ required: true, unique: true }),
      },
    }),
  ],
});
`;

beforeEach(() => {
  mkdirSync(ROOT, { recursive: true });
});

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe("migrateGenerate (drizzle-kit)", () => {
  test("writes the bridge file + drives drizzle-kit to produce a real migration", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_CONFIG);

    const result = await migrateGenerate({ cwd, name: "init" });

    expect(result.status).toBe("delegated");
    expect(result.bridge).toBe(join(cwd, "drizzle/schema.gen.ts"));
    expect(result.outDir).toBe(join(cwd, "migrations"));

    // Bridge file is written and exports each slug as a literal Drizzle table.
    const bridge = readFileSync(result.bridge, "utf8");
    expect(bridge).toMatch(/from "drizzle-orm\/sqlite-core"/);
    expect(bridge).toMatch(/export const posts = sqliteTable\("posts", \{/);
    expect(bridge).toMatch(/title: text\("title"\)\.notNull\(\)/);

    // Drizzle-kit owns: migration filename, snapshot, journal.
    const migrations = readdirSync(result.outDir).filter((f) => f.endsWith(".sql"));
    expect(migrations).toHaveLength(1);
    expect(migrations[0]).toMatch(/^0000_.+\.sql$/);

    const first = migrations[0];
    if (!first) throw new Error("expected at least one migration");
    const sql = readFileSync(join(result.outDir, first), "utf8");
    expect(sql).toMatch(/CREATE TABLE `posts`/);
    // id is text PRIMARY KEY with a UUID v4 default + NOT NULL.
    expect(sql).toMatch(/`id` text PRIMARY KEY DEFAULT \(lower\(hex\(randomblob/);
    expect(sql).toMatch(/`id` text[\s\S]*NOT NULL/);
    expect(sql).toMatch(/`created_at` integer/);
    expect(sql).toMatch(/`deleted_at` integer/);
    expect(sql).toMatch(/`title` text NOT NULL/);

    expect(existsSync(join(result.outDir, "meta", "_journal.json"))).toBe(true);
    expect(existsSync(join(result.outDir, "meta", "0000_snapshot.json"))).toBe(true);
  });

  test("re-running with no schema changes is a no-op", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_CONFIG);

    await migrateGenerate({ cwd, name: "init" });
    await migrateGenerate({ cwd, name: "init" });

    const migrations = readdirSync(join(cwd, "migrations")).filter((f) => f.endsWith(".sql"));
    expect(migrations).toHaveLength(1);
  });

  test("propagates drizzle-kit failures with a clear error", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_CONFIG);

    // Point at a stub that always exits non-zero.
    const stub = join(cwd, "fail.sh");
    writeFileSync(stub, "#!/usr/bin/env bash\nexit 7\n");
    await Bun.spawn(["chmod", "+x", stub]).exited;

    await expect(migrateGenerate({ cwd, drizzleKitBin: stub })).rejects.toThrow(
      /exited with status 7/,
    );
  });
});
