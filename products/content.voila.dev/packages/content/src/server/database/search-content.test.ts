// Pure full-text content helpers: field selection, value flattening, and the
// FTS5 MATCH-query builder. No database — exercised directly.

import { describe, expect, it } from "bun:test";
import { fields } from "@voila/content";
import {
  buildSearchContent,
  resolveSearchFields,
  type SearchFieldInfo,
  toMatchQuery,
} from "./search-content";

const fieldMap = {
  title: fields.string({ required: true }),
  body: fields.markdown(),
  secret: fields.secret(),
  count: fields.number(),
  tags: fields.multiSelect({ options: ["a", "b", "c"] }),
};

describe("resolveSearchFields", () => {
  it("returns null when search is off", () => {
    expect(resolveSearchFields(fieldMap, undefined)).toBeNull();
    expect(resolveSearchFields(fieldMap, false)).toBeNull();
  });

  it("auto-selects text kinds (skipping secret/number) when true", () => {
    const resolved = resolveSearchFields(fieldMap, true);
    expect(resolved?.map((f) => f.fieldName)).toEqual(["title", "body", "tags"]);
  });

  it("takes an explicit list verbatim, in order, any kind", () => {
    const resolved = resolveSearchFields(fieldMap, ["count", "title"]);
    expect(resolved?.map((f) => f.fieldName)).toEqual(["count", "title"]);
  });

  it("ignores unknown field names in an explicit list", () => {
    const resolved = resolveSearchFields(fieldMap, ["title", "nope"]);
    expect(resolved?.map((f) => f.fieldName)).toEqual(["title"]);
  });
});

describe("buildSearchContent", () => {
  const infos: ReadonlyArray<SearchFieldInfo> = [
    { fieldName: "title", kind: "string", localized: false },
    { fieldName: "body", kind: "richText", localized: false },
    { fieldName: "tags", kind: "multiSelect", localized: false },
    { fieldName: "name", kind: "string", localized: true },
  ];

  it("concatenates strings, rich-text leaf text, arrays, and every locale", () => {
    const content = buildSearchContent(infos, {
      title: "Hello World",
      body: [{ type: "p", children: [{ text: "deep" }, { text: "text" }] }],
      tags: ["a", "c"],
      name: { en: "English", fr: "Français" },
    });
    expect(content).toBe("Hello World deep text a c English Français");
  });

  it("skips null/undefined and non-rich-text objects", () => {
    const content = buildSearchContent(infos, {
      title: "Only",
      body: null,
      tags: undefined,
      name: { en: "Just" },
    });
    expect(content).toBe("Only Just");
  });
});

describe("toMatchQuery", () => {
  it("returns null for blank input", () => {
    expect(toMatchQuery("")).toBeNull();
    expect(toMatchQuery("   ")).toBeNull();
  });

  it("quotes each token as a prefix term (implicit AND)", () => {
    expect(toMatchQuery("foo bar")).toBe('"foo"* "bar"*');
  });

  it("neutralizes embedded quotes so operators can't inject", () => {
    expect(toMatchQuery('a"b')).toBe('"a""b"*');
  });
});
