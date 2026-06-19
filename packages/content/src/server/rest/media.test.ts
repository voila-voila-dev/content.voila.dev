// The `_media` routes end to end through `createRestHandler`: multipart upload
// into a `Storage` adapter + `voila_media` record, library list, record fetch,
// file serve (streamed and signed-redirect variants), delete, the size cap,
// and how the routes sit behind the auth/CSRF guard. The table comes from
// `deriveSchema`, the bytes go to the in-memory adapter — the same seams
// production uses.

import { beforeEach, describe, expect, it } from "bun:test";
import { defineCollection, defineConfig, fields, type NormalizedConfig } from "@voila/content";
import { deriveSchema } from "../../sql";
import { issueCsrfToken } from "../auth/csrf";
import { makeBunSqliteDriver, type SqliteDriver } from "../database/bun-sqlite-driver";
import { makeDatabase } from "../database/database";
import { makeMediaStore } from "../media/store";
import type { Storage } from "../storage";
import { makeMemoryStorage } from "../storage";
import type { ApiFailure } from "./errors";
import type { RestContext } from "./handlers";
import type { MediaContext } from "./media";
import { sanitizeFilename } from "./media";
import { createRestHandler, type RestHandlerOptions } from "./router";

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

let driver: SqliteDriver;
let storage: Storage;

beforeEach(async () => {
  driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  storage = makeMemoryStorage();
});

function handler(
  mediaOverrides: Partial<MediaContext> = {},
  options: RestHandlerOptions = {},
): (request: Request) => Promise<Response | null> {
  const ctx: RestContext = {
    config,
    database: makeDatabase(config, driver),
    media: { storage, store: makeMediaStore(driver), ...mediaOverrides },
  };
  return createRestHandler(ctx, { basePath: "/admin/api", ...options });
}

async function send(
  handle: (r: Request) => Promise<Response | null>,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await handle(new Request(`https://x/admin/api${path}`, init));
  if (response === null) throw new Error(`route not matched: ${path}`);
  return response;
}

function uploadBody(content: string, opts: { alt?: string; width?: string } = {}): FormData {
  const form = new FormData();
  form.append("file", new File([content], "Photo of a Cat!.png", { type: "image/png" }));
  if (opts.alt !== undefined) form.append("alt", opts.alt);
  if (opts.width !== undefined) form.append("width", opts.width);
  return form;
}

async function dataOf<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}

async function errorOf(response: Response): Promise<ApiFailure> {
  const body = (await response.json()) as { error: ApiFailure };
  return body.error;
}

interface WireMedia {
  id: string;
  url: string;
  key: string;
  filename: string;
  mime: string;
  size: number;
  alt?: string;
  width?: number;
}

describe("upload", () => {
  it("stores bytes + record and returns a MediaValue (201)", async () => {
    const handle = handler();
    const res = await send(handle, "/_media", {
      method: "POST",
      body: uploadBody("png-bytes", { alt: "a cat", width: "800" }),
    });
    expect(res.status).toBe(201);
    const value = await dataOf<WireMedia>(res);
    expect(value.filename).toBe("Photo_of_a_Cat_.png");
    expect(value.mime).toBe("image/png");
    expect(value.size).toBe(9);
    expect(value.alt).toBe("a cat");
    expect(value.width).toBe(800);
    expect(value.url).toBe(`/admin/api/_media/${value.id}/file`);

    const stored = await storage.get(value.key);
    expect(new TextDecoder().decode(stored?.body)).toBe("png-bytes");
  });

  it("rejects a non-multipart body and a missing file part (400)", async () => {
    const handle = handler();
    const noBody = await send(handle, "/_media", { method: "POST", body: "not a form" });
    expect(noBody.status).toBe(400);

    const empty = new FormData();
    empty.append("alt", "no file");
    const missing = await send(handle, "/_media", { method: "POST", body: empty });
    expect(missing.status).toBe(400);
    expect((await errorOf(missing)).code).toBe("BAD_REQUEST");
  });

  it("rejects malformed dimensions (400)", async () => {
    const handle = handler();
    const res = await send(handle, "/_media", {
      method: "POST",
      body: uploadBody("x", { width: "-3" }),
    });
    expect(res.status).toBe(400);
  });

  it("caps the upload size (413 TOO_LARGE)", async () => {
    const handle = handler({ maxBytes: 4 });
    const res = await send(handle, "/_media", { method: "POST", body: uploadBody("12345") });
    expect(res.status).toBe(413);
    const failure = await errorOf(res);
    expect(failure.code).toBe("TOO_LARGE");
    if (failure.code === "TOO_LARGE") {
      expect(failure.maxBytes).toBe(4);
      expect(failure.size).toBe(5);
    }
  });
});

describe("record + library reads", () => {
  it("fetches a record by id and 404s an unknown one", async () => {
    const handle = handler();
    const uploaded = await dataOf<WireMedia>(
      await send(handle, "/_media", { method: "POST", body: uploadBody("x") }),
    );

    const fetched = await dataOf<WireMedia>(await send(handle, `/_media/${uploaded.id}`));
    expect(fetched.id).toBe(uploaded.id);
    expect(fetched.url).toBe(uploaded.url);

    const missing = await send(handle, "/_media/nope");
    expect(missing.status).toBe(404);
    expect((await errorOf(missing)).code).toBe("NOT_FOUND");
  });

  it("lists the library newest-first with pagination", async () => {
    const handle = handler();
    for (const n of [1, 2, 3]) {
      await send(handle, "/_media", { method: "POST", body: uploadBody(`file-${n}`) });
    }
    const first = await send(handle, "/_media?limit=2");
    const firstBody = (await first.json()) as { data: WireMedia[]; nextCursor: string | null };
    expect(firstBody.data.length).toBe(2);
    expect(firstBody.nextCursor).not.toBeNull();

    const rest = await send(handle, `/_media?limit=2&cursor=${firstBody.nextCursor}`);
    const restBody = (await rest.json()) as { data: WireMedia[]; nextCursor: string | null };
    expect(restBody.data.length).toBe(1);
    expect(restBody.nextCursor).toBeNull();
  });

  it("rejects a malformed limit (400)", async () => {
    const handle = handler();
    expect((await send(handle, "/_media?limit=zero")).status).toBe(400);
  });

  it("maps a malformed cursor to 400 INVALID_CURSOR (not a 500)", async () => {
    const handle = handler();
    const res = await send(handle, "/_media?cursor=not-a-cursor");
    expect(res.status).toBe(400);
    expect((await errorOf(res)).code).toBe("INVALID_CURSOR");
  });
});

describe("file serve", () => {
  it("streams the bytes with the record's mime when the backend can't sign", async () => {
    const handle = handler();
    const uploaded = await dataOf<WireMedia>(
      await send(handle, "/_media", { method: "POST", body: uploadBody("the-bytes") }),
    );
    const res = await send(handle, `/_media/${uploaded.id}/file`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-length")).toBe("9");
    expect(await res.text()).toBe("the-bytes");
  });

  it("302s to a signed URL when the backend signs", async () => {
    const signing: Storage = {
      ...storage,
      signedUrl: async (key, opts) =>
        `https://bucket.example/${key}?expires=${opts.expiresIn}&sig=abc`,
    };
    const handle = handler({ storage: signing, signedUrlExpiresIn: 120 });
    const uploaded = await dataOf<WireMedia>(
      await send(handle, "/_media", { method: "POST", body: uploadBody("x") }),
    );
    const res = await send(handle, `/_media/${uploaded.id}/file`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      `https://bucket.example/${uploaded.key}?expires=120&sig=abc`,
    );
  });

  it("404s when the record exists but the object is gone", async () => {
    const handle = handler();
    const uploaded = await dataOf<WireMedia>(
      await send(handle, "/_media", { method: "POST", body: uploadBody("x") }),
    );
    await storage.delete(uploaded.key);
    expect((await send(handle, `/_media/${uploaded.id}/file`)).status).toBe(404);
  });
});

describe("delete", () => {
  it("removes the bytes and the record", async () => {
    const handle = handler();
    const uploaded = await dataOf<WireMedia>(
      await send(handle, "/_media", { method: "POST", body: uploadBody("x") }),
    );
    const res = await send(handle, `/_media/${uploaded.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await storage.get(uploaded.key)).toBeNull();
    expect((await send(handle, `/_media/${uploaded.id}`)).status).toBe(404);
  });

  it("404s an unknown id", async () => {
    const handle = handler();
    expect((await send(handle, "/_media/nope", { method: "DELETE" })).status).toBe(404);
  });
});

describe("dispatch + guard", () => {
  it("doesn't own the routes when no media context is wired", async () => {
    const ctx: RestContext = { config, database: makeDatabase(config, driver) };
    const handle = createRestHandler(ctx, { basePath: "/admin/api" });
    expect(await handle(new Request("https://x/admin/api/_media"))).toBeNull();
  });

  it("CSRF-checks the upload like any other mutation", async () => {
    const SECRET = "media-test-secret";
    const handle = handler({}, { csrf: { secret: SECRET } });

    const blocked = await send(handle, "/_media", { method: "POST", body: uploadBody("x") });
    expect(blocked.status).toBe(403);
    expect((await errorOf(blocked)).code).toBe("CSRF");

    const token = await issueCsrfToken(SECRET);
    const allowed = await send(handle, "/_media", {
      method: "POST",
      body: uploadBody("x"),
      headers: { cookie: `voila_csrf=${token}`, "x-csrf-token": token },
    });
    expect(allowed.status).toBe(201);
  });

  it("exposes `_media` to the RBAC hook as the collection", async () => {
    const seen: Array<string> = [];
    const handle = handler(
      {},
      {
        auth: { authenticate: async () => ({ id: "u1" }) },
        access: ({ collection, operation }) => {
          seen.push(`${operation}:${collection}`);
          return operation !== "delete";
        },
      },
    );
    const uploaded = await dataOf<WireMedia>(
      await send(handle, "/_media", { method: "POST", body: uploadBody("x") }),
    );
    const denied = await send(handle, `/_media/${uploaded.id}`, { method: "DELETE" });
    expect(denied.status).toBe(403);
    expect(seen).toEqual(["create:_media", "delete:_media"]);
  });

  it("reports an unexpected media failure to the mount-level onError", async () => {
    const seen: unknown[] = [];
    const handle = handler(
      { store: { ...makeMediaStore(driver), list: () => Promise.reject(new Error("boom")) } },
      { onError: (error) => seen.push(error) },
    );
    const response = await send(handle, "/_media");
    expect(response.status).toBe(500);
    expect((await errorOf(response)).code).toBe("INTERNAL");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBeInstanceOf(Error);
  });
});

describe("sanitizeFilename", () => {
  it("keeps a safe basename and replaces the rest", () => {
    expect(sanitizeFilename("Photo of a Cat!.png")).toBe("Photo_of_a_Cat_.png");
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\boot.ini")).toBe("boot.ini");
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("...")).toBe("file");
    expect(sanitizeFilename(`${"x".repeat(200)}.png`).length).toBe(128);
  });
});
