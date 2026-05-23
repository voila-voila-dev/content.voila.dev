import { afterEach, describe, expect, test } from "bun:test";
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
import { schemaGenerate } from "./schema-generate.ts";

const ROOT = resolve(import.meta.dir, "..", "..", ".tmp-schema");
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

afterEach(() => {
  while (dirs.length) {
    const d = dirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

const POSTS_AND_SITE = `import { defineCollection, defineContent, defineSingleton } from "@voila/content";
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
    defineCollection({
      slug: "tags",
      fields: { name: fields.string({ required: true }) },
    }),
  ],
  singletons: [
    defineSingleton({
      slug: "site",
      fields: { title: fields.string({ required: true }) },
    }),
  ],
});
`;

describe("schemaGenerate", () => {
  test("emits literal sqliteTable(...) calls per slug", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_AND_SITE);

    const result = await schemaGenerate({ cwd });

    expect(result.bridge).toBe(join(cwd, "drizzle/schema.gen.ts"));
    expect(result.collections).toEqual(["posts", "tags", "site"]);
    expect(result.dialect).toBe("sqlite");

    const src = readFileSync(result.bridge, "utf8");
    // Each table is a literal sqliteTable(...) call — no `_tables[...]`
    // indexing, no `any` collapse.
    expect(src).toMatch(/export const posts = sqliteTable\("posts", \{/);
    expect(src).toMatch(/title: text\("title"\)\.notNull\(\)/);
    expect(src).toMatch(/slug: text\("slug"\)\.notNull\(\)\.unique\(\)/);
    expect(src).toMatch(/export const tags = sqliteTable\("tags", \{/);
    expect(src).toMatch(/export const site = sqliteTable\("site", \{/);

    // Singletons carry the CHECK constraint.
    expect(src).toMatch(/check\("site_singleton", sql`\${t\.id} = 'site'`\)/);

    // Bridge is self-contained — no runtime dep on content.config.
    expect(src).not.toMatch(/from "\.\.\/content\.config"/);
    expect(src).not.toMatch(/schemaToTables/);

    // System columns emitted on every table.
    expect(src).toMatch(/id: text\("id"\)\.primaryKey\(\)/);
    expect(src).toMatch(/createdAt: integer\("created_at", \{ mode: "timestamp_ms" \}\)/);
    expect(src).toMatch(/deletedAt: integer\("deleted_at", \{ mode: "timestamp_ms" \}\)/);

    // Only the helpers actually referenced are imported — no `real`, `boolean`,
    // `date`, `jsonb` clutter when the schema doesn't use them.
    expect(src).toMatch(
      /import \{ check, integer, sqliteTable, text \} from "drizzle-orm\/sqlite-core";/,
    );
    expect(src).not.toMatch(/, real,/);
    expect(src).not.toMatch(/, boolean,/);
  });

  test("imports only the column helpers actually used", async () => {
    const cwd = tmpDir();
    writeConfig(
      cwd,
      `import { defineCollection, defineContent } from "@voila/content";
import { fields } from "@voila/content-schema";

export default defineContent({
  collections: [
    defineCollection({
      slug: "metrics",
      fields: {
        rating: fields.number(),
        active: fields.boolean(),
        payload: fields.json(),
      },
    }),
  ],
});
`,
    );

    const result = await schemaGenerate({ cwd });
    const src = readFileSync(result.bridge, "utf8");

    // `real` is used (non-integer number), so it must appear.
    // No singleton ⇒ no `check`.
    expect(src).toMatch(/import \{ integer, real, sqliteTable, text \}/);
    expect(src).not.toMatch(/\bcheck\b,/);
  });

  test("emits pg-core types when --dialect=postgres", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_AND_SITE);

    const result = await schemaGenerate({ cwd, dialect: "postgres" });

    expect(result.dialect).toBe("postgres");
    const src = readFileSync(result.bridge, "utf8");
    expect(src).toMatch(/from "drizzle-orm\/pg-core"/);
    expect(src).toMatch(/export const posts = pgTable\("posts", \{/);
    expect(src).toMatch(
      /createdAt: timestamp\("created_at", \{ withTimezone: true, mode: "date" \}\)/,
    );
  });

  test("emits the right base type per field kind (sqlite)", async () => {
    const cwd = tmpDir();
    writeConfig(
      cwd,
      `import { defineCollection, defineContent } from "@voila/content";
import { fields } from "@voila/content-schema";

export default defineContent({
  collections: [
    defineCollection({
      slug: "everything",
      fields: {
        s: fields.string(),
        n: fields.number(),
        i: fields.number({ integer: true }),
        b: fields.boolean(),
        d: fields.date(),
        dt: fields.datetime(),
        j: fields.json(),
      },
    }),
  ],
});
`,
    );

    const result = await schemaGenerate({ cwd });
    const src = readFileSync(result.bridge, "utf8");

    expect(src).toMatch(/s: text\("s"\)/);
    expect(src).toMatch(/n: real\("n"\)/);
    expect(src).toMatch(/i: integer\("i"\),/);
    expect(src).toMatch(/b: integer\("b", \{ mode: "boolean" \}\)/);
    expect(src).toMatch(/d: text\("d"\)/);
    expect(src).toMatch(/dt: integer\("dt", \{ mode: "timestamp_ms" \}\)/);
    expect(src).toMatch(/j: text\("j", \{ mode: "json" \}\)/);
  });

  test("honors --bridge for the output path", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_AND_SITE);

    const result = await schemaGenerate({ cwd, bridge: "custom/path.ts" });

    expect(result.bridge).toBe(join(cwd, "custom/path.ts"));
    expect(existsSync(result.bridge)).toBe(true);
  });

  test("does not invoke drizzle-kit (no migrations dir created)", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_AND_SITE);

    await schemaGenerate({ cwd });

    expect(existsSync(join(cwd, "migrations"))).toBe(false);
  });

  test("re-writing with the same content is idempotent", async () => {
    const cwd = tmpDir();
    writeConfig(cwd, POSTS_AND_SITE);

    await schemaGenerate({ cwd });
    const firstContent = readFileSync(join(cwd, "drizzle/schema.gen.ts"), "utf8");
    await schemaGenerate({ cwd });
    const secondContent = readFileSync(join(cwd, "drizzle/schema.gen.ts"), "utf8");

    expect(secondContent).toBe(firstContent);
    expect(readdirSync(join(cwd, "drizzle"))).toEqual(["schema.gen.ts"]);
  });

  test("emits an empty-collection block when no slugs are defined", async () => {
    const cwd = tmpDir();
    writeConfig(
      cwd,
      `import { defineContent } from "@voila/content";
export default defineContent({ collections: [], singletons: [] });
`,
    );

    const result = await schemaGenerate({ cwd });

    expect(result.collections).toEqual([]);
    const src = readFileSync(result.bridge, "utf8");
    expect(src).toMatch(/no collections defined yet/);
    expect(src).toMatch(/export \{\};/);
  });
});
