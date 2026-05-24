import { describe, expect, test } from "bun:test";
import { defineCollection, defineContent, defineSingleton, fields } from "@voila/content";
import { createClient } from "./client.ts";
import { ContentClientError } from "./errors.ts";
import type { FetchLike } from "./types.ts";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.string({ required: true, unique: true }),
    views: fields.number({ integer: true }),
  },
});

const config = defineSingleton({
  slug: "config",
  fields: { siteName: fields.string({ required: true }) },
});

const content = defineContent({ collections: [posts], singletons: [config] });

type Call = { url: string; init?: RequestInit };

function recordingFetch(routes: Record<string, () => Response>): {
  fetch: FetchLike;
  calls: Call[];
} {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const handler = routes[url];
    if (!handler) {
      return new Response(JSON.stringify({ error: { code: "INTERNAL", message: "no route" } }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
    return handler();
  };
  return { fetch: fetchImpl, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createClient", () => {
  test("list hits GET /:collection and unwraps the envelope", async () => {
    const row = {
      id: "p1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      title: "Hello",
      slug: "hello",
      views: 10,
    };
    const { fetch, calls } = recordingFetch({
      "/admin/api/posts": () => jsonResponse(200, { data: [row], nextCursor: null }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    const result = await client.posts.list();

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/admin/api/posts");
    expect(result.data).toEqual([row]);
    expect(result.nextCursor).toBeNull();
  });

  test("list serializes limit/cursor/orderBy/order as query params", async () => {
    const { fetch, calls } = recordingFetch({
      "/admin/api/posts?limit=10&cursor=abc&orderBy=views&order=asc": () =>
        jsonResponse(200, { data: [], nextCursor: null }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    await client.posts.list({ limit: 10, cursor: "abc", orderBy: "views", order: "asc" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("/admin/api/posts?limit=10&cursor=abc&orderBy=views&order=asc");
  });

  test("find hits GET /:collection/:id and returns the unwrapped row", async () => {
    const row = {
      id: "p1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      title: "Hello",
      slug: "hello",
    };
    const { fetch } = recordingFetch({
      "/admin/api/posts/p1": () => jsonResponse(200, { data: row }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    expect(await client.posts.find({ id: "p1" })).toEqual(row);
  });

  test("findOne picks the one field/value and hits /by/:field/:value", async () => {
    const row = {
      id: "p1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
      title: "Hello",
      slug: "hello",
    };
    const { fetch, calls } = recordingFetch({
      "/admin/api/posts/by/slug/hello": () => jsonResponse(200, { data: row }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    expect(await client.posts.findOne({ slug: "hello" })).toEqual(row);
    expect(calls[0]!.url).toBe("/admin/api/posts/by/slug/hello");
  });

  test("findOne throws synchronously when more than one field is supplied", async () => {
    const { fetch } = recordingFetch({});
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    // biome-ignore lint/suspicious/noExplicitAny: deliberately bypassing the FindOneArgs check to test the runtime guard.
    await expect(client.posts.findOne({ slug: "a", title: "b" } as any)).rejects.toThrow(
      /exactly one field/,
    );
  });

  test("URL-encodes collection slug, ids, and values", async () => {
    const { fetch, calls } = recordingFetch({
      "/admin/api/posts/by/slug/hello%20world": () => jsonResponse(200, { data: { id: "x" } }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    await client.posts.findOne({ slug: "hello world" });

    expect(calls[0]!.url).toBe("/admin/api/posts/by/slug/hello%20world");
  });

  test("trailing slash on baseUrl is tolerated", async () => {
    const { fetch, calls } = recordingFetch({
      "/admin/api/posts/p1": () => jsonResponse(200, { data: { id: "p1" } }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api/", fetch });

    await client.posts.find({ id: "p1" });

    expect(calls[0]!.url).toBe("/admin/api/posts/p1");
  });

  test("non-2xx with a structured envelope throws ContentClientError with the server code", async () => {
    const { fetch } = recordingFetch({
      "/admin/api/posts/missing": () =>
        jsonResponse(404, { error: { code: "NOT_FOUND", collectionSlug: "posts" } }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    const err = await client.posts.find({ id: "missing" }).catch((e) => e);
    expect(err).toBeInstanceOf(ContentClientError);
    expect((err as ContentClientError).status).toBe(404);
    expect((err as ContentClientError).code).toBe("NOT_FOUND");
  });

  test("non-2xx without a parseable body collapses to INTERNAL", async () => {
    const { fetch } = recordingFetch({
      "/admin/api/posts/x": () =>
        new Response("not json", { status: 500, headers: { "content-type": "text/plain" } }),
    });
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    const err = (await client.posts.find({ id: "x" }).catch((e) => e)) as ContentClientError;
    expect(err.code).toBe("INTERNAL");
    expect(err.status).toBe(500);
  });

  test("init is forwarded on every request", async () => {
    const { fetch, calls } = recordingFetch({
      "/admin/api/posts/p1": () => jsonResponse(200, { data: { id: "p1" } }),
    });
    const client = createClient<typeof content>({
      baseUrl: "/admin/api",
      fetch,
      init: { credentials: "include", headers: { authorization: "Bearer abc" } },
    });

    await client.posts.find({ id: "p1" });

    expect(calls[0]!.init?.credentials).toBe("include");
    expect((calls[0]!.init?.headers as Record<string, string>).authorization).toBe("Bearer abc");
  });

  test("per-collection clients are memoized per slug", async () => {
    const { fetch } = recordingFetch({});
    const client = createClient<typeof content>({ baseUrl: "/admin/api", fetch });

    expect(client.posts).toBe(client.posts);
  });
});
