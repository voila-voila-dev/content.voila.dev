import { describe, expect, test } from "bun:test";
import { slugify } from "./slugify.ts";

describe("slugify", () => {
  test("lowercases and joins words with the separator", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("strips diacritics", () => {
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
  });

  test("collapses runs of punctuation and trims by default", () => {
    expect(slugify("  Foo -- Bar!!  ")).toBe("foo-bar");
  });

  test("honors a custom separator", () => {
    expect(slugify("Hello World", "_")).toBe("hello_world");
  });

  test("keeps a trailing separator when trim is off (live typing)", () => {
    expect(slugify("foo ", "-", { trim: false })).toBe("foo-");
  });

  test("returns an empty string for separator-only input", () => {
    expect(slugify("  !! ")).toBe("");
  });
});
