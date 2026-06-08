import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { datetime } from "./datetime";

describe("fields.datetime", () => {
  it("decodes epoch milliseconds to a Date", () => {
    const f = datetime();
    const decoded = decodeSync(f, 0);
    expect(decoded).toBeInstanceOf(Date);
    expect(decoded.getTime()).toBe(0);
    expect(f.meta.kind).toBe("datetime");
  });

  it("passes an existing Date through", () => {
    const f = datetime();
    const d = new Date(1_000);
    expect(decodeSync(f, d)).toBe(d);
  });

  it("rejects non-finite numbers and other types", () => {
    const f = datetime();
    expect(() => decodeSync(f, Number.NaN)).toThrow();
    expect(() => decodeSync(f, "2026-06-08")).toThrow();
  });
});
