import { describe, expect, it } from "bun:test";
import { toColumnName } from "./to-column-name";

describe("toColumnName", () => {
  it.each([
    ["title", "title"],
    ["createdAt", "created_at"],
    ["publishedAt", "published_at"],
    ["primaryColor", "primary_color"],
    ["siteName", "site_name"],
    ["authorId2", "author_id2"],
    ["already_snake", "already_snake"],
  ] as const)("%s → %s", (input, expected) => {
    expect(toColumnName(input)).toBe(expected);
  });
});
