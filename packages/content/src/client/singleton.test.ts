// The singleton client accessors end to end: `makeClient` is wired to the real
// REST dispatcher (over in-memory `bun:sqlite`, singleton CHECK in place), so
// `client.settings.get()/set()` exercise the full stack — `get` is `null` until
// the first `set`, `set` upserts the one row pinned to `id = slug`. Types are
// checked by `tsc` compiling this file (see `typeChecks` below).

import { beforeEach, describe, expect, it } from "bun:test";
import {
  defineCollection,
  defineConfig,
  defineSingleton,
  fields,
  type NormalizedConfig,
} from "@voila/content";
import { makeBunSqliteDriver } from "../server/database/bun-sqlite-driver";
import { makeDatabase } from "../server/database/database";
import { createRestHandler, type RestContext } from "../server/rest";
import { deriveSchema } from "../sql";
import { type ContentClient, isContentClientError, makeClient, type Stored } from "./index";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }) },
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

let client: ContentClient<typeof config>;

beforeEach(async () => {
  const driver = makeBunSqliteDriver({ url: ":memory:" });
  for (const statement of schemaStatements(config)) await driver.run(statement);
  const ctx: RestContext = { config, database: makeDatabase(config, driver) };
  const handle = createRestHandler(ctx, { basePath: "/admin/api" });

  const fetchImpl: typeof fetch = async (input, init) => {
    const response = await handle(new Request(input as string, init));
    return (
      response ?? new Response(JSON.stringify({ error: { code: "INTERNAL" } }), { status: 500 })
    );
  };

  client = makeClient(config, { baseUrl: "https://x/admin/api", fetch: fetchImpl });
});

describe("singleton client accessors", () => {
  it("get() is null until the first set()", async () => {
    expect(await client.settings.get()).toBeNull();
  });

  it("set() creates the document and returns the stored row", async () => {
    const stored = await client.settings.set({ siteName: "Acme", tagline: "hello" });
    expect(stored.id).toBe("settings");
    expect(stored.siteName).toBe("Acme");
    expect(typeof stored.createdAt).toBe("number");
  });

  it("get() returns what set() wrote", async () => {
    await client.settings.set({ siteName: "Acme", tagline: "hello" });
    const fetched = await client.settings.get();
    expect(fetched?.siteName).toBe("Acme");
    expect(fetched?.tagline).toBe("hello");
  });

  it("a second set() replaces the document in place", async () => {
    const first = await client.settings.set({ siteName: "Acme", tagline: "hello" });
    const second = await client.settings.set({ siteName: "Acme 2", tagline: "bye" });
    expect(second.id).toBe(first.id);
    expect(second.siteName).toBe("Acme 2");
    expect(second.createdAt).toBe(first.createdAt);
  });

  it("set() surfaces validation failures as typed errors", async () => {
    // Cast past the compile-time check — the runtime 422 path is what's under test.
    const error = await client.settings
      .set({ tagline: "no name" } as never)
      .catch((e: unknown) => e);
    expect(isContentClientError(error)).toBe(true);
    if (isContentClientError(error)) expect(error.failure.code).toBe("VALIDATION");
  });

  it("collection accessors coexist with singleton accessors", async () => {
    await client.posts.create({ title: "Hi" });
    const page = await client.posts.list();
    expect(page.data.length).toBe(1);
  });
});

// Compile-time assertions: the singleton accessor is typed from the config —
// `tsc` compiling this file is the test.
// biome-ignore lint/correctness/noUnusedVariables: type-level checks only.
async function typeChecks(): Promise<void> {
  const fetched: Stored<{ siteName: string; tagline: string }> | null = await client.settings.get();
  void fetched;
  const stored: Stored<{ siteName: string; tagline: string }> = await client.settings.set({
    siteName: "Acme",
    tagline: "hello",
  });
  void stored;
  // @ts-expect-error — singletons have no list().
  client.settings.list;
  // @ts-expect-error — set() requires the full payload.
  await client.settings.set({ tagline: "no name" });
}
