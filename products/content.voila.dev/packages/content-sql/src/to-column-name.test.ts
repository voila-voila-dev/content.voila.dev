import { describe, expect, test } from "bun:test";
import { toColumnName } from "./to-column-name.ts";

describe("toColumnName", () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["id", "id"],
    ["createdAt", "created_at"],
    ["updatedAt", "updated_at"],
    ["deletedAt", "deleted_at"],
    ["title", "title"],
    // documented rule: trailing acronym collapses to lower
    ["htmlURL", "html_url"],
    // acronym followed by Word splits at the boundary
    ["XMLParser", "xml_parser"],
    // multi-word
    ["someLongFieldName", "some_long_field_name"],
    // digit boundary
    ["v2Schema", "v2_schema"],
  ];

  for (const [input, expected] of cases) {
    test(`${input} → ${expected}`, () => {
      expect(toColumnName(input)).toBe(expected);
    });
  }
});
