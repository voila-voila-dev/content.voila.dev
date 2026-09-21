import { afterEach, describe, expect, test } from "bun:test";
import { readPreviewSize, writePreviewSize } from "./preview-split";

afterEach(() => localStorage.clear());

describe("preview split size", () => {
  test("falls back to the configured default, clamped, when nothing is stored", () => {
    expect(readPreviewSize("pages", undefined)).toBe(50);
    expect(readPreviewSize("pages", 35)).toBe(35);
    expect(readPreviewSize("pages", 5)).toBe(20);
    expect(readPreviewSize("pages", 95)).toBe(80);
  });

  test("remembers the last split per slug", () => {
    writePreviewSize("pages", 62.4);
    expect(readPreviewSize("pages", 50)).toBe(62);
    expect(readPreviewSize("posts", 50)).toBe(50);
    localStorage.setItem("voila:preview-size:pages", "garbage");
    expect(readPreviewSize("pages", 40)).toBe(40);
  });
});
