import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { sqlite } from "@voila/content-database/sqlite";
import { fields } from "@voila/content-schema";
import { sql } from "drizzle-orm";
import { defineCollection, defineContent } from "../define.ts";
import { handleFindByField, handleFindById, handleList } from "./handlers/index.ts";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.string({ required: true, unique: true }),
    views: fields.number({ integer: true }),
    published: fields.boolean(),
    meta: fields.json(),
  },
});

const content = defineContent({ collections: [posts] });

// Five posts, oldest → newest. Default order is createdAt desc, so the natural
// listing is p5, p4, p3, p2, p1.
const SEED = [
  { id: "p1", createdAt: 1000, title: "First", slug: "first", views: 10 },
  { id: "p2", createdAt: 2000, title: "Second", slug: "second", views: 20 },
  { id: "p3", createdAt: 3000, title: "Third", slug: "third", views: 30 },
  { id: "p4", createdAt: 4000, title: "Fourth", slug: "fourth", views: 40 },
  { id: "p5", createdAt: 5000, title: "Fifth", slug: "fifth", views: 50 },
];

let adapter: ReturnType<typeof sqlite>;

beforeEach(() => {
  adapter = sqlite({ url: ":memory:" });
  adapter.drizzle.run(
    sql.raw(`
    CREATE TABLE "posts" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "created_at" INTEGER NOT NULL,
      "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      "deleted_at" INTEGER,
      "title" TEXT NOT NULL,
      "slug" TEXT NOT NULL UNIQUE,
      "views" INTEGER,
      "published" INTEGER,
      "meta" TEXT
    )
  `),
  );
  for (const r of SEED) {
    adapter.drizzle.run(
      sql.raw(
        `INSERT INTO "posts" ("id","created_at","title","slug","views") VALUES ('${r.id}',${r.createdAt},'${r.title}','${r.slug}',${r.views})`,
      ),
    );
  }
});

afterEach(() => adapter.close?.());

function listReq(qs = ""): Request {
  return new Request(`http://localhost/admin/api/posts${qs}`);
}

async function json(res: Response): Promise<{ status: number; body: any }> {
  return { status: res.status, body: await res.json() };
}

describe("handleList", () => {
  test("returns all rows newest-first by default", async () => {
    const { status, body } = await json(
      await handleList({ request: listReq(), params: { collection: "posts" }, content, adapter }),
    );
    expect(status).toBe(200);
    expect(body.data.map((r: { id: string }) => r.id)).toEqual(["p5", "p4", "p3", "p2", "p1"]);
    expect(body.nextCursor).toBeNull();
  });

  test("paginates with an opaque cursor, no offset", async () => {
    const ids: string[] = [];
    let cursor: string | null = null;
    // Walk the whole collection two rows at a time.
    for (let page = 0; page < 5; page++) {
      const qs = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const { body } = await json(
        await handleList({
          request: listReq(qs),
          params: { collection: "posts" },
          content,
          adapter,
        }),
      );
      ids.push(...body.data.map((r: { id: string }) => r.id));
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    expect(ids).toEqual(["p5", "p4", "p3", "p2", "p1"]);
    expect(cursor).toBeNull();
  });

  test("honors orderBy + order on a field column", async () => {
    const { body } = await json(
      await handleList({
        request: listReq("?orderBy=views&order=asc"),
        params: { collection: "posts" },
        content,
        adapter,
      }),
    );
    expect(body.data.map((r: { views: number }) => r.views)).toEqual([10, 20, 30, 40, 50]);
  });

  test("excludes soft-deleted rows", async () => {
    adapter.drizzle.run(sql.raw(`UPDATE "posts" SET "deleted_at" = 9999 WHERE "id" = 'p3'`));
    const { body } = await json(
      await handleList({ request: listReq(), params: { collection: "posts" }, content, adapter }),
    );
    expect(body.data.map((r: { id: string }) => r.id)).toEqual(["p5", "p4", "p2", "p1"]);
  });

  test("404s on an unknown collection", async () => {
    const { status, body } = await json(
      await handleList({
        request: new Request("http://localhost/admin/api/ghosts"),
        params: { collection: "ghosts" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("UNKNOWN_COLLECTION");
  });

  test("400s on an invalid limit", async () => {
    const { status, body } = await json(
      await handleList({
        request: listReq("?limit=0"),
        params: { collection: "posts" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("400s when ordering by a non-sortable / unknown column", async () => {
    for (const key of ["meta", "nope"]) {
      const { status, body } = await json(
        await handleList({
          request: listReq(`?orderBy=${key}`),
          params: { collection: "posts" },
          content,
          adapter,
        }),
      );
      expect(status).toBe(400);
      expect(body.error.code).toBe("INVALID_ORDER");
    }
  });

  test("400s on a malformed cursor", async () => {
    const { status, body } = await json(
      await handleList({
        request: listReq("?cursor=not-a-real-cursor!!"),
        params: { collection: "posts" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("INVALID_CURSOR");
  });
});

describe("handleFindById", () => {
  test("returns the matching row", async () => {
    const { status, body } = await json(
      await handleFindById({
        request: new Request("http://localhost/admin/api/posts/p2"),
        params: { collection: "posts", id: "p2" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(200);
    expect(body.data.slug).toBe("second");
  });

  test("404s for a missing id", async () => {
    const { status, body } = await json(
      await handleFindById({
        request: new Request("http://localhost/admin/api/posts/nope"),
        params: { collection: "posts", id: "nope" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("404s for a soft-deleted id", async () => {
    adapter.drizzle.run(sql.raw(`UPDATE "posts" SET "deleted_at" = 9999 WHERE "id" = 'p1'`));
    const { status } = await json(
      await handleFindById({
        request: new Request("http://localhost/admin/api/posts/p1"),
        params: { collection: "posts", id: "p1" },
        content,
        adapter,
      }),
    );
    expect(status).toBe(404);
  });
});

describe("handleFindByField", () => {
  function byField(field: string, value: string) {
    return handleFindByField({
      request: new Request(`http://localhost/admin/api/posts/by/${field}/${value}`),
      params: { collection: "posts", field, value },
      content,
      adapter,
    });
  }

  test("finds a row by a unique field", async () => {
    const { status, body } = await json(await byField("slug", "third"));
    expect(status).toBe(200);
    expect(body.data.id).toBe("p3");
  });

  test("400s for a non-unique field", async () => {
    const { status, body } = await json(await byField("title", "First"));
    expect(status).toBe(400);
    expect(body.error.code).toBe("FIELD_NOT_UNIQUE");
  });

  test("404s for an unknown field", async () => {
    const { status, body } = await json(await byField("nope", "x"));
    expect(status).toBe(404);
    expect(body.error.code).toBe("UNKNOWN_FIELD");
  });

  test("404s when the unique value matches nothing", async () => {
    const { status, body } = await json(await byField("slug", "missing"));
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
