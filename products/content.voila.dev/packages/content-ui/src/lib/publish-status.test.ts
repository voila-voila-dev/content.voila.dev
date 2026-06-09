import { describe, expect, test } from "bun:test";
import { publishStatus } from "./publish-status";

const NOW = 1_000_000;

describe("publishStatus", () => {
  test("null for a document with no status (non-draft collection)", () => {
    expect(publishStatus({ id: "1", title: "x" }, NOW)).toBeNull();
  });

  test("draft when status is draft", () => {
    expect(publishStatus({ status: "draft", publishedAt: null }, NOW)).toBe("draft");
  });

  test("published when status is published and publishedAt has elapsed", () => {
    expect(publishStatus({ status: "published", publishedAt: NOW - 1 }, NOW)).toBe("published");
  });

  test("published when status is published with no publishedAt", () => {
    expect(publishStatus({ status: "published", publishedAt: null }, NOW)).toBe("published");
  });

  test("scheduled when published but publishedAt is in the future", () => {
    expect(publishStatus({ status: "published", publishedAt: NOW + 1 }, NOW)).toBe("scheduled");
  });

  test("an unrecognized status is treated as no status", () => {
    expect(publishStatus({ status: "weird" }, NOW)).toBeNull();
  });
});
