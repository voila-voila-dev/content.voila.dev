import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { postgres } from "@voila/content-database/postgres";
import { sql } from "drizzle-orm";
import { migrateApply } from "./migrate-apply.ts";
import { migrateGenerate } from "./migrate-generate.ts";

// The postgres apply path needs a real server. Set TEST_POSTGRES_URL (e.g. via
// docker compose in CI) to opt in; without it, that block is skipped.
const TEST_POSTGRES_URL = process.env.TEST_POSTGRES_URL;

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

describe("migrateApply (postgres, via drizzle migrator)", () => {
  test("rejects postgres target without --db", async () => {
    const cwd = tmpDir();
    await expect(migrateApply({ cwd, target: "postgres" })).rejects.toThrow(
      /--db is required when target is "postgres"/,
    );
  });

  describe.skipIf(!TEST_POSTGRES_URL)("against TEST_POSTGRES_URL", () => {
    const url = TEST_POSTGRES_URL as string;

    // Drop everything the migration created so the suite is re-runnable. The
    // postgres migrator tracks state in the `drizzle` schema; the generated
    // DDL creates `posts` in `public`.
    async function reset(): Promise<void> {
      const adapter = postgres({ url });
      try {
        await adapter.drizzle.execute(sql`DROP TABLE IF EXISTS "posts" CASCADE`);
        await adapter.drizzle.execute(sql`DROP SCHEMA IF EXISTS "drizzle" CASCADE`);
      } finally {
        await adapter.close?.();
      }
    }

    test("applies the generated migration and is idempotent", async () => {
      const cwd = tmpDir();
      writeConfig(cwd);
      await migrateGenerate({ cwd, name: "init", dialect: "postgres" });
      await reset();

      const first = await migrateApply({ cwd, target: "postgres", db: url });
      expect(first).toEqual({ target: "postgres", delegated: false });

      // Re-running applies nothing new — the migrator's tracking table guards it.
      const second = await migrateApply({ cwd, target: "postgres", db: url });
      expect(second).toEqual({ target: "postgres", delegated: false });

      const adapter = postgres({ url });
      try {
        const rows = (await adapter.drizzle.execute(
          sql`SELECT to_regclass('public.posts')::text AS t`,
        )) as unknown as Array<{ t: string | null }>;
        expect(rows[0]?.t).toBe("posts");
      } finally {
        await adapter.close?.();
        await reset();
      }
    });
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
