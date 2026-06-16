// `makeMediaClient` end to end against the real `_media` routes — the same
// fetch-into-dispatcher bridge the collection client tests use, with bytes in
// the in-memory storage adapter and records in a deriveSchema-built
// `voila_media` table.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { makeBunSqliteDriver } from "../server/database/bun-sqlite-driver";
import { makeDatabase } from "../server/database/database";
import { makeMediaStore } from "../server/media/store";
import { createRestHandler, type RestContext } from "../server/rest";
import { makeMemoryStorage, type Storage } from "../server/storage";
import { deriveSchema } from "../sql";
import { isContentClientError, type MediaClient, makeMediaClient } from "./index";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }), cover: fields.media() },
});

const config = defineConfig({ branding: { name: "Test" }, collections: { posts } });

function schemaStatements(cfg: NormalizedConfig): ReadonlyArray<string> {
  const stmts: Array<string> = [];
  for (const table of deriveSchema(cfg)) {
    const cols = table.columns.map((c) => {
      const parts = [`"${c.name}"`, c.type.sqlite];
      if (c.primaryKey) parts.push("PRIMARY KEY");
      else if (c.notNull) parts.push("NOT NULL");
      return parts.join(" ");
    });
    stmts.push(`CREATE TABLE "${table.name}" (${cols.join(", ")})`);
    for (const idx of table.indexes) {
      const idxCols = idx.columns.map((c) => `"${c}"`).join(", ");
      stmts.push(
        `CREATE ${idx.unique ? "UNIQUE " : ""}INDEX "${idx.name}" ON "${idx.table}" (${idxCols})`,
      );
    }
  }
  return stmts;
}

let media: MediaClient;
let storage: Storage;

beforeEach(async () => {
  const driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  storage = makeMemoryStorage();
  const ctx: RestContext = {
    config,
    database: makeDatabase(config, driver),
    media: { storage, store: makeMediaStore(driver) },
  };
  const handle = createRestHandler(ctx, { basePath: "/admin/api" });

  const fetchImpl: typeof fetch = async (input, init) => {
    const response = await handle(new Request(input as string, init));
    return (
      response ?? new Response(JSON.stringify({ error: { code: "INTERNAL" } }), { status: 500 })
    );
  };

  media = makeMediaClient({ baseUrl: "https://x/admin/api", fetch: fetchImpl });
});

describe("upload", () => {
  it("uploads a file and returns the stored MediaValue", async () => {
    const item = await media.upload(new File(["bytes!"], "cat.png", { type: "image/png" }), {
      alt: "a cat",
      width: 800,
      height: 600,
    });
    expect(item.filename).toBe("cat.png");
    expect(item.mime).toBe("image/png");
    expect(item.size).toBe(6);
    expect(item.alt).toBe("a cat");
    expect(item.width).toBe(800);
    expect(item.height).toBe(600);
    expect(item.url).toBe(`/admin/api/_media/${item.id}/file`);
  });

  it("uploads a bare Blob under an explicit filename", async () => {
    const item = await media.upload(new Blob(["x"], { type: "text/plain" }), {
      filename: "note.txt",
    });
    expect(item.filename).toBe("note.txt");
    // The runtime may append a charset when a Blob crosses FormData.
    expect(item.mime).toStartWith("text/plain");
  });

  it("surfaces server rejections as typed errors", async () => {
    try {
      await media.delete("missing");
      throw new Error("expected a ContentClientError");
    } catch (error) {
      if (!isContentClientError(error)) throw error;
      expect(error.status).toBe(404);
      expect(error.failure.code).toBe("NOT_FOUND");
    }
  });
});

describe("reads", () => {
  it("gets a record by id and resolves null for an unknown one", async () => {
    const item = await media.upload(new File(["x"], "a.png", { type: "image/png" }));
    const fetched = await media.get(item.id);
    expect(fetched?.id).toBe(item.id);
    expect(await media.get("missing")).toBeNull();
  });

  it("pages the library newest-first", async () => {
    for (const name of ["one.png", "two.png", "three.png"]) {
      await media.upload(new File([name], name, { type: "image/png" }));
    }
    const first = await media.list({ limit: 2 });
    expect(first.data.length).toBe(2);
    expect(first.nextCursor).not.toBeNull();
    const rest = await media.list({ limit: 2, cursor: first.nextCursor ?? undefined });
    expect(rest.data.length).toBe(1);
    expect(rest.nextCursor).toBeNull();
  });

  it("builds the file URL without a request", () => {
    expect(media.fileUrl("abc")).toBe("https://x/admin/api/_media/abc/file");
  });
});

describe("delete", () => {
  it("removes the bytes and the record", async () => {
    const item = await media.upload(new File(["x"], "a.png", { type: "image/png" }));
    await media.delete(item.id);
    expect(await media.get(item.id)).toBeNull();
    expect(await storage.get(item.key)).toBeNull();
  });
});
