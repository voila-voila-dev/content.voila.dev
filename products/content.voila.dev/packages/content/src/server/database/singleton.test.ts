// Singleton write path over real (in-memory) SQLite, with the DDL `CHECK`
// constraint in place: `create` pins the one row's id to the slug (a random
// UUID could never insert), and `upsert` creates the row on first write,
// patches it afterwards, revives a soft-deleted row, and rejects non-singleton
// collections.

import { beforeEach, describe, expect, it } from "bun:test";
import {
  defineCollection,
  defineConfig,
  defineSingleton,
  fields,
  type NormalizedConfig,
} from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver } from "./bun-sqlite-driver";
import { DatabaseError, makeDatabase } from "./database";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string() },
});

const settings = defineSingleton({
  slug: "settings",
  fields: {
    siteName: fields.string({ required: true }),
    tagline: fields.string(),
  },
});

const config = defineConfig({
  branding: { name: "Test" },
  collections: { posts },
  singletons: { settings },
});

// Renders the singleton `CHECK ("id" = '<slug>')` too, so these tests prove the
// engine's writes satisfy the real DDL — the exact constraint that made
// UUID-keyed singleton creates fail with an opaque INTERNAL.
function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      return parts.join(" ");
    });
    if (table.singletonCheck) cols.push(`CHECK ("id" = '${table.singletonCheck.id}')`);
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
  }
  return stmts;
}

let db: ReturnType<typeof makeDatabase>;

beforeEach(async () => {
  const driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  db = makeDatabase(config, driver);
});

describe("Database singleton writes", () => {
  it("create pins the row id to the slug (passes the DDL CHECK)", async () => {
    const doc = await db.create("settings", { siteName: "Acme" });
    expect(doc.id).toBe("settings");
    expect(doc.siteName).toBe("Acme");
    expect(typeof doc.createdAt).toBe("number");
  });

  it("a second create conflicts instead of inserting a second row", async () => {
    await db.create("settings", { siteName: "Acme" });
    const error = await db.create("settings", { siteName: "Again" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).conflict).toBe(true);
  });

  it("upsert creates the row when missing", async () => {
    const doc = await db.upsert("settings", { siteName: "Acme", tagline: "hi" });
    expect(doc.id).toBe("settings");
    expect(doc.tagline).toBe("hi");
    expect(await db.get("settings", "settings")).not.toBeNull();
  });

  it("upsert patches the existing row in place", async () => {
    const first = await db.upsert("settings", { siteName: "Acme", tagline: "hi" });
    const second = await db.upsert("settings", { siteName: "Acme 2" });
    expect(second.id).toBe("settings");
    expect(second.siteName).toBe("Acme 2");
    expect(second.tagline).toBe("hi"); // untouched fields survive
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt as number).toBeGreaterThanOrEqual(first.updatedAt as number);
  });

  it("upsert revives a soft-deleted singleton", async () => {
    await db.upsert("settings", { siteName: "Acme" });
    await db.softDelete("settings", "settings");
    expect(await db.get("settings", "settings")).toBeNull();
    const revived = await db.upsert("settings", { siteName: "Back" });
    expect(revived.deletedAt).toBeNull();
    expect(revived.siteName).toBe("Back");
    expect(await db.get("settings", "settings")).not.toBeNull();
  });

  it("upsert rejects a non-singleton collection", async () => {
    const error = await db.upsert("posts", { title: "Hi" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DatabaseError);
    expect((error as DatabaseError).message).toContain("not a singleton");
  });
});
