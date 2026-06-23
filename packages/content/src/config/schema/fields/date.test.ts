import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { date } from "./date";

describe("fields.date", () => {
  it("decodes an ISO date-only string", () => {
    const f = date();
    expect(decodeSync(f, "2026-06-08")).toBe("2026-06-08");
    expect(f.meta.kind).toBe("date");
  });

  it("rejects a non date-only string", () => {
    const f = date();
    expect(() => decodeSync(f, "2026-06-08T10:00:00Z")).toThrow();
    expect(() => decodeSync(f, "not-a-date")).toThrow();
  });
});
