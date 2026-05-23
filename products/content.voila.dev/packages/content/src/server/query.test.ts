import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content-schema";
import { defineCollection } from "../define.ts";
import type { Result } from "../shared/result.ts";
import type { ApiErrorCode } from "./errors.ts";
import {
  coerceFieldValue,
  decodeCursor,
  encodeCursor,
  kindOfKey,
  parseListQuery,
} from "./query.ts";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ unique: true }),
    views: fields.number({ integer: true }),
    live: fields.boolean(),
    at: fields.datetime(),
    meta: fields.json(),
  },
});

function url(qs: string): URL {
  return new URL(`http://localhost/admin/api/posts${qs}`);
}

function expectFail<T, E extends { code: ApiErrorCode }>(result: Result<T, E>, code: E["code"]): E {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure result");
  expect(result.error.code).toBe(code);
  return result.error;
}

function expectValue<T, E>(result: Result<T, E>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("kindOfKey", () => {
  test("resolves system + scalar fields, rejects json and unknown", () => {
    expect(kindOfKey(posts, "id")).toBe("string");
    expect(kindOfKey(posts, "createdAt")).toBe("datetime");
    expect(kindOfKey(posts, "views")).toBe("number");
    expect(kindOfKey(posts, "meta")).toBeUndefined();
    expect(kindOfKey(posts, "nope")).toBeUndefined();
  });
});

describe("parseListQuery", () => {
  test("defaults to 25 rows, newest-first by createdAt", () => {
    const value = expectValue(parseListQuery(url(""), posts));
    expect(value).toMatchObject({
      limit: 25,
      orderKey: "createdAt",
      direction: "desc",
      cursor: null,
    });
  });

  test("reads limit, orderBy, and order", () => {
    const value = expectValue(parseListQuery(url("?limit=10&orderBy=views&order=asc"), posts));
    expect(value).toMatchObject({ limit: 10, orderKey: "views", direction: "asc" });
  });

  test.each([
    ["?limit=0"],
    ["?limit=101"],
    ["?limit=abc"],
    ["?limit=2.5"],
  ])("rejects bad limit %s", (qs) => {
    expectFail(parseListQuery(url(qs), posts), "BAD_REQUEST");
  });

  test("rejects an unknown order direction", () => {
    expectFail(parseListQuery(url("?order=sideways"), posts), "BAD_REQUEST");
  });

  test("rejects ordering by a json or unknown column, carrying the offending key", () => {
    const meta = expectFail(parseListQuery(url("?orderBy=meta"), posts), "INVALID_ORDER");
    expect(meta).toMatchObject({ collectionSlug: "posts", orderKey: "meta" });
    const nope = expectFail(parseListQuery(url("?orderBy=nope"), posts), "INVALID_ORDER");
    expect(nope).toMatchObject({ collectionSlug: "posts", orderKey: "nope" });
  });
});

describe("cursor (de)serialization", () => {
  test("roundtrips a payload through url-safe base64", () => {
    const cursor = { c: 1717000000000, id: "01HXYZ" };
    const token = encodeCursor(cursor);
    expect(token).not.toMatch(/[+/=]/);
    expect(expectValue(decodeCursor(token))).toEqual(cursor);
  });

  test("rejects malformed tokens", () => {
    expectFail(decodeCursor("!!!not base64!!!"), "INVALID_CURSOR");
    expectFail(decodeCursor(encodeCursor({ c: 1, id: "x" }).slice(0, 3)), "INVALID_CURSOR");
  });
});

describe("coerceFieldValue", () => {
  test("coerces per field kind", () => {
    expect(expectValue(coerceFieldValue(fields.string(), "hello"))).toBe("hello");
    expect(expectValue(coerceFieldValue(fields.number(), "42"))).toBe(42);
    expect(expectValue(coerceFieldValue(fields.boolean(), "true"))).toBe(true);
    expect(expectValue(coerceFieldValue(fields.boolean(), "0"))).toBe(false);
    expect(expectValue(coerceFieldValue(fields.datetime(), "2026-05-23T00:00:00Z"))).toBeInstanceOf(
      Date,
    );
  });

  test("rejects un-coercible values", () => {
    expectFail(coerceFieldValue(fields.number(), "nope"), "BAD_REQUEST");
    expectFail(coerceFieldValue(fields.boolean(), "maybe"), "BAD_REQUEST");
    expectFail(coerceFieldValue(fields.datetime(), "not-a-date"), "BAD_REQUEST");
    expectFail(coerceFieldValue(fields.json(), "{}"), "BAD_REQUEST");
  });
});
