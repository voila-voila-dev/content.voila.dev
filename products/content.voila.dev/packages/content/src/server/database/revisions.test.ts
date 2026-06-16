// Version history over real (in-memory) SQLite. A revisions-enabled collection
// snapshots every content write (create, update, publish, unpublish) into the
// shared `voila_revisions` table; history lists newest-first with cursor
// pagination, and restoring a past revision re-applies its content fields
// through the normal update path (appending a new revision — linear history).
// Collections that didn't opt in reject the revision methods.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema, REVISIONS_TABLE } from "../../sql";
import { makeBunSqliteDriver, type SqliteDriver } from "./bun-sqlite-driver";
import { DatabaseError, makeDatabase } from "./database";

const posts = defineCollection({
  slug: "posts",
  drafts: true,
  revisions: true,
  fields: { title: fields.string({ required: true }), rank: fields.number() },
});

// A contrast collection without revisions, to prove the methods are rejected
// and its writes never snapshot.
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

describe("revisions schema", () => {
  it("emits the shared voila_revisions table only when a collection opted in", () => {
    const tables = deriveSchema(config);
    const store = tables.find((t) => t.name === REVISIONS_TABLE);
    expect(store?.system).toBe(true);
    expect(store?.columns.map((c) => c.name)).toEqual([
      "id",
      "collection",
      "document_id",
      "rev",
      "data",
      "created_at",
    ]);

    const without = defineConfig({ branding: { name: "Test" }, collections: { pages } });
    expect(deriveSchema(without).some((t) => t.name === REVISIONS_TABLE)).toBe(false);
  });
});

describe("revisions workflow", () => {
  let driver: SqliteDriver;
  let db: ReturnType<typeof makeDatabase>;

  beforeEach(async () => {
    driver = makeBunSqliteDriver({ url: ":memory:" });
    db = makeDatabase(config, driver);
    await createTables(config, driver);
  });

  it("does not expose the revision store as a collection", async () => {
    expect(db.list(REVISIONS_TABLE)).rejects.toThrow("Unknown collection");
  });

  it("create snapshots revision 1 with the stored row", async () => {
    const created = await db.create("posts", { title: "Hello" });
    const { revisions, nextCursor } = await db.listRevisions("posts", created.id as string);
    expect(revisions).toHaveLength(1);
    expect(nextCursor).toBeNull();
    expect(revisions[0]?.rev).toBe(1);
    expect(typeof revisions[0]?.createdAt).toBe("number");
    expect(revisions[0]?.doc.title).toBe("Hello");
    // The snapshot is the full stored row — system + draft columns included.
    expect(revisions[0]?.doc.id).toBe(created.id);
    expect(revisions[0]?.doc.status).toBe("draft");
  });

  it("update, publish, and unpublish each append a revision, newest first", async () => {
    const created = await db.create("posts", { title: "v1" });
    const id = created.id as string;
    await db.update("posts", id, { title: "v2" });
    await db.publish("posts", id);
    await db.unpublish("posts", id);
    const { revisions } = await db.listRevisions("posts", id);
    expect(revisions.map((r) => r.rev)).toEqual([4, 3, 2, 1]);
    expect(revisions.map((r) => r.doc.title)).toEqual(["v2", "v2", "v2", "v1"]);
    expect(revisions.map((r) => r.doc.status)).toEqual(["draft", "published", "draft", "draft"]);
  });

  it("pages history by revision-number cursor", async () => {
    const created = await db.create("posts", { title: "v1" });
    const id = created.id as string;
    for (let n = 2; n <= 5; n++) await db.update("posts", id, { title: `v${n}` });

    const first = await db.listRevisions("posts", id, { limit: 2 });
    expect(first.revisions.map((r) => r.rev)).toEqual([5, 4]);
    expect(first.nextCursor).toBe("4");

    const second = await db.listRevisions("posts", id, {
      limit: 2,
      cursor: first.nextCursor as string,
    });
    expect(second.revisions.map((r) => r.rev)).toEqual([3, 2]);

    const last = await db.listRevisions("posts", id, {
      limit: 2,
      cursor: second.nextCursor as string,
    });
    expect(last.revisions.map((r) => r.rev)).toEqual([1]);
    expect(last.nextCursor).toBeNull();
  });

  it("getRevision fetches one snapshot; a missing rev is null", async () => {
    const created = await db.create("posts", { title: "v1" });
    const id = created.id as string;
    await db.update("posts", id, { title: "v2" });
    const rev = await db.getRevision("posts", id, 1);
    expect(rev?.doc.title).toBe("v1");
    expect(await db.getRevision("posts", id, 99)).toBeNull();
  });

  it("restoreRevision re-applies content fields and appends a new revision", async () => {
    const created = await db.create("posts", { title: "v1", rank: 1 });
    const id = created.id as string;
    await db.update("posts", id, { title: "v2", rank: 2 });

    const restored = await db.restoreRevision("posts", id, 1);
    expect(restored?.title).toBe("v1");
    expect(restored?.rank).toBe(1);

    // History stayed linear: the restore appended rev 3 rather than rewinding.
    const { revisions } = await db.listRevisions("posts", id);
    expect(revisions.map((r) => r.rev)).toEqual([3, 2, 1]);
    expect(revisions[0]?.doc.title).toBe("v1");
  });

  it("restoreRevision leaves publish state untouched", async () => {
    const created = await db.create("posts", { title: "v1" });
    const id = created.id as string;
    await db.update("posts", id, { title: "v2" });
    await db.publish("posts", id);

    // Rev 1 was a draft snapshot; restoring it must not unpublish the row.
    const restored = await db.restoreRevision("posts", id, 1);
    expect(restored?.title).toBe("v1");
    expect(restored?.status).toBe("published");
  });

  it("restoreRevision drops snapshot fields the config no longer declares", async () => {
    const created = await db.create("posts", { title: "v1" });
    const id = created.id as string;
    // Hand-plant a snapshot carrying a field that has since been removed from
    // the config — restoring must not crash the UPDATE on a missing column.
    await driver.run(
      `INSERT INTO "${REVISIONS_TABLE}" ("id", "collection", "document_id", "rev", "data", "created_at") VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        "posts",
        id,
        2,
        JSON.stringify({ id, title: "old", legacyField: "gone" }),
        Date.now(),
      ],
    );
    const restored = await db.restoreRevision("posts", id, 2);
    expect(restored?.title).toBe("old");
    expect(restored && "legacyField" in restored).toBe(false);
  });

  it("restoreRevision on a missing revision or row returns null", async () => {
    const created = await db.create("posts", { title: "v1" });
    const id = created.id as string;
    expect(await db.restoreRevision("posts", id, 99)).toBeNull();
    // A soft-deleted row can't be written to, even with a valid revision.
    await db.softDelete("posts", id);
    expect(await db.restoreRevision("posts", id, 1)).toBeNull();
  });

  it("rejects revision methods on a collection that didn't opt in", async () => {
    const page = await db.create("pages", { title: "About" });
    const id = page.id as string;
    expect(db.listRevisions("pages", id)).rejects.toThrow("not revisions-enabled");
    expect(db.getRevision("pages", id, 1)).rejects.toThrow(DatabaseError);
    expect(db.restoreRevision("pages", id, 1)).rejects.toThrow("not revisions-enabled");
  });

  it("ignores a malformed cursor (first page returned)", async () => {
    const created = await db.create("posts", { title: "v1" });
    const { revisions } = await db.listRevisions("posts", created.id as string, {
      cursor: "garbage",
    });
    expect(revisions.map((r) => r.rev)).toEqual([1]);
  });
});
