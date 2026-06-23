// Draft/published workflow over real (in-memory) SQLite. A draft-enabled
// collection starts rows as drafts, hides them from the default (published)
// list, supports scheduled publishing (`publishedAt` in the future isn't live
// yet), and round-trips through publish/unpublish. Non-draft collections reject
// publish state changes.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "./bun-sqlite-driver";
import { DatabaseError, makeDatabase } from "./database";

const posts = defineCollection({
  slug: "posts",
  drafts: true,
  fields: { title: fields.string({ required: true }) },
});

// A second collection without drafts, to prove publish/unpublish is rejected.
const pages = defineCollection({
  slug: "pages",
  fields: { title: fields.string({ required: true }) },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts, pages } });

function createTables(cfg: NormalizedConfig, driver: SqliteDriver): Promise<unknown> {
  return Promise.all(
    deriveSchema(cfg).map((table) => {
      const cols = table.columns.map((c) => {
        const parts = [`"${c.name}"`, c.type.sqlite];
        if (c.primaryKey) parts.push("PRIMARY KEY");
        else if (c.notNull) parts.push("NOT NULL");
        if (c.defaultExpr?.sqlite) parts.push(`DEFAULT ${c.defaultExpr.sqlite}`);
        return parts.join(" ");
      });
      return driver.run(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
    }),
  );
}

describe("drafts workflow", () => {
  let driver: SqliteDriver;
  let db: ReturnType<typeof makeDatabase>;

  beforeEach(async () => {
    driver = makeBunSqliteDriver({ url: ":memory:" });
    db = makeDatabase(config, driver);
    await createTables(config, driver);
  });

  it("derives status + publishedAt only for draft-enabled collections", () => {
    const tables = deriveSchema(config);
    const postCols = tables.find((t) => t.name === "posts")?.columns.map((c) => c.name);
    const pageCols = tables.find((t) => t.name === "pages")?.columns.map((c) => c.name);
    expect(postCols).toContain("status");
    expect(postCols).toContain("published_at");
    expect(pageCols).not.toContain("status");
  });

  it("creates rows as drafts, hidden from the default list", async () => {
    const created = await db.create("posts", { title: "Hello" });
    expect(created.status).toBe("draft");
    expect(created.publishedAt).toBeNull();
    const live = await db.list("posts");
    expect(live.documents).toHaveLength(0);
  });

  it("status:draft and status:any widen the listing", async () => {
    await db.create("posts", { title: "A" });
    expect((await db.list("posts", { status: "draft" })).documents).toHaveLength(1);
    expect((await db.list("posts", { status: "any" })).documents).toHaveLength(1);
    expect((await db.list("posts", { status: "published" })).documents).toHaveLength(0);
  });

  it("publish makes a row live and visible by default", async () => {
    const created = await db.create("posts", { title: "Hello" });
    const published = await db.publish("posts", created.id as string);
    expect(published?.status).toBe("published");
    expect(typeof published?.publishedAt).toBe("number");
    const live = await db.list("posts");
    expect(live.documents.map((d) => d.id)).toEqual([created.id]);
  });

  it("a future publishedAt schedules publication (not live yet)", async () => {
    const created = await db.create("posts", { title: "Soon" });
    await db.publish("posts", created.id as string, { at: Date.now() + 60_000 });
    expect((await db.list("posts")).documents).toHaveLength(0);
    // It is published-status, just not yet live — visible under `any`.
    expect((await db.list("posts", { status: "any" })).documents).toHaveLength(1);
  });

  it("status:scheduled lists only published rows with a future publishedAt", async () => {
    const soon = await db.create("posts", { title: "Soon" });
    const live = await db.create("posts", { title: "Live" });
    await db.create("posts", { title: "Draft" });
    await db.publish("posts", soon.id as string, { at: Date.now() + 60_000 });
    await db.publish("posts", live.id as string);
    const scheduled = await db.list("posts", { status: "scheduled" });
    expect(scheduled.documents.map((d) => d.id)).toEqual([soon.id]);
  });

  it("unpublish returns a row to draft", async () => {
    const created = await db.create("posts", { title: "Hello" });
    await db.publish("posts", created.id as string);
    const back = await db.unpublish("posts", created.id as string);
    expect(back?.status).toBe("draft");
    expect(back?.publishedAt).toBeNull();
    expect((await db.list("posts")).documents).toHaveLength(0);
  });

  it("publish/unpublish on a missing row returns null", async () => {
    expect(await db.publish("posts", "nope")).toBeNull();
    expect(await db.unpublish("posts", "nope")).toBeNull();
  });

  it("publish on a soft-deleted row returns null", async () => {
    const created = await db.create("posts", { title: "Hello" });
    await db.softDelete("posts", created.id as string);
    expect(await db.publish("posts", created.id as string)).toBeNull();
  });

  it("rejects publish on a non-draft collection", async () => {
    const page = await db.create("pages", { title: "About" });
    expect(db.publish("pages", page.id as string)).rejects.toThrow(DatabaseError);
    expect(db.publish("pages", page.id as string)).rejects.toThrow("not draft-enabled");
  });

  it("a non-draft collection ignores the status filter (all rows live)", async () => {
    await db.create("pages", { title: "About" });
    expect((await db.list("pages")).documents).toHaveLength(1);
    expect((await db.list("pages", { status: "draft" })).documents).toHaveLength(1);
  });
});
