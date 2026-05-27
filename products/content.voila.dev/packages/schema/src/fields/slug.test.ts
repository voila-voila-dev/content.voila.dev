import { describe, expect, test } from "bun:test";
import { slug } from "./slug.ts";

describe("slug", () => {
  test("returns a slug FieldDef with no options", () => {
    expect(slug()).toEqual({ kind: "slug" });
  });

  test("preserves the derive source and separator", () => {
    const field = slug({ from: "title", separator: "_", unique: true });
    expect(field).toEqual({ kind: "slug", from: "title", separator: "_", unique: true });
  });
});
