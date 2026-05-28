import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { defineCollection, defineContent, defineSingleton } from "./define.ts";
import { Database, type DatabaseShape } from "./services/database.ts";

const fakeDatabase: DatabaseShape = {
  list: () => Effect.succeed({ rows: [], nextCursor: null }),
  get: () => Effect.succeed(null),
  insert: (_c, row) => Effect.succeed(row),
  update: (_c, _id, patch) => Effect.succeed({ ...patch } as Record<string, unknown>),
  softDelete: () => Effect.void,
  restore: () => Effect.void,
};

describe("defineCollection", () => {
  test("preserves the literal slug type and shape", () => {
    const posts = defineCollection({
      slug: "posts",
      fields: { title: Schema.String },
    });
    expect(posts.slug).toBe("posts");
    expect(posts.kind).toBe("collection");
    expect(Object.keys(posts.fields)).toEqual(["title"]);
    // Type-level: posts.slug is "posts", not string.
    const slug: "posts" = posts.slug;
    expect(slug).toBe("posts");
  });
});

describe("defineSingleton", () => {
  test("preserves the literal slug type and shape", () => {
    const site = defineSingleton({
      slug: "site-settings",
      fields: { name: Schema.String },
    });
    expect(site.slug).toBe("site-settings");
    expect(site.kind).toBe("singleton");
    const slug: "site-settings" = site.slug;
    expect(slug).toBe("site-settings");
  });
});

describe("defineContent", () => {
  test("builds a ManagedRuntime that can be disposed without errors", async () => {
    const posts = defineCollection({
      slug: "posts",
      fields: { title: Schema.String },
    });

    const content = defineContent({
      branding: { name: "Test" },
      collections: [posts],
      database: Layer.succeed(Database, fakeDatabase),
    });

    // `defineContent` spreads the config onto its return value so the vended
    // admin shell can read `config.branding` directly off the default export.
    expect(content.branding.name).toBe("Test");
    expect(typeof content.dispose).toBe("function");
    expect(content.runtime).toBeDefined();

    await content.dispose();
  });

  test("runtime resolves the Database service end-to-end", async () => {
    const content = defineContent({
      branding: { name: "Wired" },
      database: Layer.succeed(Database, fakeDatabase),
    });

    try {
      const result = await content.runtime.runPromise(
        Effect.gen(function* () {
          const db = yield* Database;
          return yield* db.list("posts", { limit: 10 });
        }),
      );
      expect(result.rows).toEqual([]);
      expect(result.nextCursor).toBeNull();
    } finally {
      await content.dispose();
    }
  });
});
