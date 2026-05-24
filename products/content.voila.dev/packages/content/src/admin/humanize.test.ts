import { describe, expect, test } from "bun:test";
import { humanizeFieldName } from "./humanize.ts";

describe("humanizeFieldName", () => {
  test.each([
    ["title", "Title"],
    ["slug", "Slug"],
    ["publishedAt", "Published At"],
    ["siteName", "Site Name"],
    ["default_locale", "Default Locale"],
    ["cover-image", "Cover Image"],
    ["siteURL", "Site URL"],
  ])("%s → %s", (input, expected) => {
    expect(humanizeFieldName(input)).toBe(expected);
  });
});
