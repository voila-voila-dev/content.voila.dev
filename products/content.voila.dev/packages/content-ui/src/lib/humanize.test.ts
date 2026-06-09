import { describe, expect, test } from "bun:test";
import { humanize } from "./humanize";

describe("humanize", () => {
  test("splits camelCase into title-cased words", () => {
    expect(humanize("publishedAt")).toBe("Published At");
  });

  test("splits snake_case and kebab-case", () => {
    expect(humanize("cover_image")).toBe("Cover Image");
    expect(humanize("hero-banner")).toBe("Hero Banner");
  });

  test("title-cases a single lowercase word", () => {
    expect(humanize("title")).toBe("Title");
  });

  test("handles digits adjacent to letters", () => {
    expect(humanize("address2")).toBe("Address2");
    expect(humanize("line1Item")).toBe("Line1 Item");
  });

  test("collapses repeated separators and trims", () => {
    expect(humanize("__a__b__")).toBe("A B");
  });
});
