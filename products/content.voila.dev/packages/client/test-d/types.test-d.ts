/**
 * Compile-time assertions for the inferred `createClient` shape. The package's
 * `tsconfig.build.json` includes this directory so `tsc -b` (and therefore
 * `bun run check` in CI) fails when an `expectType`, `assertEquals`, or
 * `@ts-expect-error` line stops holding. The bodies use `bun:test`'s `test`
 * harness purely to scope the assertions — nothing here exercises runtime
 * behavior.
 */

import { test } from "bun:test";
import { defineCollection, defineContent, defineSingleton, fields } from "@voila/content";
import type { ContentClient, ListResult, Row } from "../src/index.ts";
import { createClient } from "../src/index.ts";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ required: true }),
    slug: fields.string({ required: true, unique: true }),
    excerpt: fields.string(),
    views: fields.number({ integer: true }),
    published: fields.boolean(),
    publishedAt: fields.datetime(),
  },
});

const pages = defineCollection({
  slug: "pages",
  fields: {
    title: fields.string({ required: true }),
    path: fields.string({ required: true, unique: true }),
  },
});

const siteConfig = defineSingleton({
  slug: "siteConfig",
  fields: { siteName: fields.string({ required: true }) },
});

const content = defineContent({
  collections: [posts, pages],
  singletons: [siteConfig],
});

type Client = ContentClient<typeof content>;

/** Compile-time identity check. Errors here are surfaced by `tsc`. */
function expectType<T>(_value: T): void {}

/** Force `Equals<A, B>` to error when the two types diverge. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function assertEquals<_T extends true>(): void {}

test("collection slugs are surfaced as top-level keys", () => {
  const client = createClient<typeof content>({ baseUrl: "/admin/api" });
  expectType<Client["posts"]>(client.posts);
  expectType<Client["pages"]>(client.pages);
});

test("list returns the precise row shape derived from the collection", async () => {
  const client = createClient<typeof content>({ baseUrl: "/admin/api" });
  const result = await client.posts.list();
  assertEquals<Equals<typeof result, ListResult<Row<typeof posts>>>>();

  // Domain fields surface their `InferField` type (today every declared field
  // is optional on the row — the schema package's field constructors don't
  // preserve `required: true` in their return type yet, so the required-vs-
  // optional distinction is a runtime-only concern). When that lands, the
  // required ones flip to non-optional and these assertions tighten.
  const row = result.data[0]!;
  expectType<string | undefined>(row.title);
  expectType<string | undefined>(row.slug);
  expectType<string | undefined>(row.excerpt);
  expectType<number | undefined>(row.views);
  expectType<boolean | undefined>(row.published);
  expectType<string | undefined>(row.publishedAt);

  // System columns are always present.
  expectType<string>(row.id);
  expectType<string>(row.createdAt);
  expectType<string>(row.updatedAt);
  expectType<string | null>(row.deletedAt);
});

test("find returns the row directly (no envelope)", async () => {
  const client = createClient<typeof content>({ baseUrl: "/admin/api" });
  const post = await client.posts.find({ id: "p1" });
  assertEquals<Equals<typeof post, Row<typeof posts>>>();
  expectType<string | undefined>(post.title);
  expectType<string>(post.id);
});

test("findOne accepts any field name with its inferred value type", async () => {
  const client = createClient<typeof content>({ baseUrl: "/admin/api" });

  const bySlug = await client.posts.findOne({ slug: "hello" });
  expectType<Row<typeof posts>>(bySlug);

  const byTitle = await client.posts.findOne({ title: "Hello" });
  expectType<Row<typeof posts>>(byTitle);

  // @ts-expect-error — `views` is a number; passing a string must not type-check.
  await client.posts.findOne({ views: "ten" });

  // @ts-expect-error — `id` isn't a field key (the row has it, the fields record doesn't).
  await client.posts.findOne({ id: "p1" });

  // @ts-expect-error — passing two field constraints is excluded by FindOneArgs.
  await client.posts.findOne({ slug: "hello", title: "Hello" });
});

test("rows for different collections don't share field shapes", async () => {
  const client = createClient<typeof content>({ baseUrl: "/admin/api" });
  const post = await client.posts.find({ id: "p1" });
  const page = await client.pages.find({ id: "p1" });

  expectType<string | undefined>(post.slug);
  expectType<string | undefined>(page.path);

  // @ts-expect-error — `pages` has no `slug` field; accessing it must not type-check.
  page.slug;

  // @ts-expect-error — `posts` has no `path` field.
  post.path;
});

test("singletons are not exposed on the M1 client surface", () => {
  const client = createClient<typeof content>({ baseUrl: "/admin/api" });

  // Collections survive.
  expectType<unknown>(client.posts);

  // @ts-expect-error — singleton slugs aren't typed onto the client yet.
  client.siteConfig;
});
