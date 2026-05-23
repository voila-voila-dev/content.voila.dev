import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { migrateApply } from "./migrate-apply.ts";
import { migrateGenerate } from "./migrate-generate.ts";

const ROOT = resolve(import.meta.dir, "..", "..", ".tmp-apply");
const dirs: string[] = [];

function tmpDir(): string {
  mkdirSync(ROOT, { recursive: true });
  const d = mkdtempSync(join(ROOT, "case-"));
  dirs.push(d);
  return d;
}

const POSTS_CONFIG = `import { defineCollection, defineContent } from "@voila/content";
import { fields } from "@voila/content-schema";

export default defineContent({
  collections: [
    defineCollection({
      slug: "posts",
      fields: { title: fields.string({ required: true }) },
    }),
  ],
});
`;

function writeConfig(cwd: string): void {
  writeFileSync(join(cwd, "content.config.ts"), POSTS_CONFIG);
}

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe("migrateApply (sqlite, via drizzle migrator)", () => {
  test("applies the generated migration to a fresh local sqlite db", async () => {
    const cwd = tmpDir();
    writeConfig(cwd);
    await migrateGenerate({ cwd, name: "init" });

    const result = await migrateApply({ cwd, target: "sqlite", db: "voila.db" });
    expect(result).toEqual({ target: "sqlite", delegated: false });

    const db = new Database(join(cwd, "voila.db"));
    try {
      const tables = db
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
        )
        .all()
        .map((r) => r.name);
      expect(tables).toContain("posts");
      // Drizzle's migrator owns the tracking table.
      expect(tables).toContain("__drizzle_migrations");
    } finally {
      db.close();
    }
  });

  test("is idempotent — re-running is a no-op", async () => {
    const cwd = tmpDir();
    writeConfig(cwd);
    await migrateGenerate({ cwd, name: "init" });

    await migrateApply({ cwd, target: "sqlite", db: "voila.db" });
    const second = await migrateApply({ cwd, target: "sqlite", db: "voila.db" });
    expect(second).toEqual({ target: "sqlite", delegated: false });
  });

  test("rejects sqlite target without --db", async () => {
    const cwd = tmpDir();
    await expect(migrateApply({ cwd, target: "sqlite" })).rejects.toThrow(/--db is required/);
  });
});

describe("migrateApply (d1)", () => {
  test("shells out to wrangler with --local", async () => {
    const cwd = tmpDir();

    const stub = join(cwd, "wrangler-stub.sh");
    const argsFile = join(cwd, "wrangler-args.txt");
    await Bun.write(
      stub,
      `#!/usr/bin/env bash
echo "$@" > "${argsFile}"
exit 0
`,
    );
    await Bun.spawn(["chmod", "+x", stub]).exited;

    const result = await migrateApply({
      cwd,
      target: "d1-local",
      binding: "DATABASE",
      wranglerBin: stub,
    });

    expect(result).toEqual({ target: "d1-local", delegated: true });
    const args = (await Bun.file(argsFile).text()).trim();
    expect(args).toBe("d1 migrations apply DATABASE --local");
  });

  test("shells out to wrangler with --remote", async () => {
    const cwd = tmpDir();

    const stub = join(cwd, "wrangler-stub.sh");
    const argsFile = join(cwd, "wrangler-args.txt");
    await Bun.write(
      stub,
      `#!/usr/bin/env bash
echo "$@" > "${argsFile}"
exit 0
`,
    );
    await Bun.spawn(["chmod", "+x", stub]).exited;

    const result = await migrateApply({
      cwd,
      target: "d1-remote",
      binding: "DATABASE",
      wranglerBin: stub,
    });

    expect(result).toEqual({ target: "d1-remote", delegated: true });
    const args = (await Bun.file(argsFile).text()).trim();
    expect(args).toBe("d1 migrations apply DATABASE --remote");
  });

  test("rejects --out for d1 when it diverges from the default", async () => {
    const cwd = tmpDir();
    await expect(
      migrateApply({
        cwd,
        target: "d1-remote",
        binding: "DATABASE",
        out: "./db/migrations",
      }),
    ).rejects.toThrow(/only supported for --target sqlite/);
  });

  test("propagates a non-zero wrangler exit", async () => {
    const cwd = tmpDir();
    const stub = join(cwd, "wrangler-stub.sh");
    await Bun.write(stub, "#!/usr/bin/env bash\nexit 5\n");
    await Bun.spawn(["chmod", "+x", stub]).exited;

    await expect(
      migrateApply({ cwd, target: "d1-remote", binding: "DATABASE", wranglerBin: stub }),
    ).rejects.toThrow(/exited with status 5/);
  });

  test("rejects d1 target without --binding", async () => {
    const cwd = tmpDir();
    await expect(migrateApply({ cwd, target: "d1-remote" })).rejects.toThrow(
      /--binding is required/,
    );
  });
});
