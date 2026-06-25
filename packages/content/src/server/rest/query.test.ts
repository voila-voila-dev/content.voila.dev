// Unit coverage for `coerceFieldValue` — the per-kind branches that the
// integration suite only reaches for text fields. A unique lookup `:value`
// arrives as a URL string and must bind as the type its column stores.

import { describe, expect, it } from "bun:test";
import { type Field, fields } from "@voila/content";
import { ApiError } from "./errors";
import { type CollectionLike, coerceFieldValue, parseFilters } from "./query";

// Narrow the public field constructors to the bare `Field` the helper accepts.
const asField = (f: unknown): Field => f as Field;

function expectBadRequest(field: Field, raw: string): void {
  try {
    coerceFieldValue(field, raw);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).failure.code).toBe("BAD_REQUEST");
    return;
  }
  throw new Error("expected coerceFieldValue to reject");
}

describe("coerceFieldValue", () => {
  it("passes text-backed kinds through verbatim", () => {
    expect(coerceFieldValue(asField(fields.string()), "hello")).toBe("hello");
    expect(coerceFieldValue(asField(fields.slug()), "my-post")).toBe("my-post");
    expect(coerceFieldValue(asField(fields.date()), "2026-06-08")).toBe("2026-06-08");
  });

  it("coerces numbers, rejecting non-numeric input", () => {
    expect(coerceFieldValue(asField(fields.number()), "42")).toBe(42);
    expect(coerceFieldValue(asField(fields.position()), "1.5")).toBe(1.5);
    expectBadRequest(asField(fields.number()), "abc");
  });

  it("coerces booleans from true/false/1/0, rejecting anything else", () => {
    expect(coerceFieldValue(asField(fields.boolean()), "true")).toBe(true);
    expect(coerceFieldValue(asField(fields.boolean()), "1")).toBe(true);
    expect(coerceFieldValue(asField(fields.boolean()), "false")).toBe(false);
    expect(coerceFieldValue(asField(fields.boolean()), "0")).toBe(false);
    expectBadRequest(asField(fields.boolean()), "maybe");
  });

  it("coerces datetimes to epoch ms, rejecting an unparseable date", () => {
    expect(coerceFieldValue(asField(fields.datetime()), "2026-06-08T00:00:00.000Z")).toBe(
      Date.parse("2026-06-08T00:00:00.000Z"),
    );
    expectBadRequest(asField(fields.datetime()), "not-a-date");
  });

  it("rejects a localized field — it has no scalar lookup value", () => {
    expectBadRequest(asField(fields.string({ localized: true })), "x");
  });

  it("rejects a JSON-backed kind as unsupported", () => {
    expectBadRequest(asField(fields.json()), "{}");
  });
});

describe("parseFilters", () => {
  const collection: CollectionLike = {
    slug: "posts",
    fields: {
      title: fields.string(),
      views: fields.number(),
      meta: fields.json(),
    } as unknown as CollectionLike["fields"],
  };
  const parse = (qs: string) => parseFilters(new URL(`https://x/posts?${qs}`), collection);

  it("parses a comparison filter, coercing the value to the field type", () => {
    expect(parse("filter=views:gte:5")).toEqual([{ field: "views", op: "gte", value: 5 }]);
  });

  it("keeps a `contains` value as the raw string", () => {
    expect(parse("filter=title:contains:hello")).toEqual([
      { field: "title", op: "contains", value: "hello" },
    ]);
  });

  it("parses multiple repeated filters in order", () => {
    expect(parse("filter=title:eq:a&filter=views:lt:9")).toEqual([
      { field: "title", op: "eq", value: "a" },
      { field: "views", op: "lt", value: 9 },
    ]);
  });

  it("returns no filters when none are present", () => {
    expect(parse("limit=10")).toEqual([]);
  });

  function expectBadFilter(qs: string): void {
    try {
      parse(qs);
    } catch (error) {
      expect((error as ApiError).failure.code).toBe("BAD_REQUEST");
      return;
    }
    throw new Error("expected parseFilters to reject");
  }

  it("rejects a malformed entry, an unknown op, an unknown field, and a JSON field", () => {
    expectBadFilter("filter=title"); // no op/value
    expectBadFilter("filter=title:bogus:x"); // unknown op
    expectBadFilter("filter=nope:eq:x"); // unknown field
    expectBadFilter("filter=meta:eq:x"); // JSON-backed field isn't filterable
  });
});
