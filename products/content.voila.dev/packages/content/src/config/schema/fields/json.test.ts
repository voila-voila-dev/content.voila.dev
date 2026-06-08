import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { json } from "./json";

describe("fields.json", () => {
  it("passes any value through untouched", () => {
    const f = json();
    expect(decodeSync(f, { a: 1, b: [2, 3] })).toEqual({ a: 1, b: [2, 3] });
    expect(decodeSync(f, "scalar")).toBe("scalar");
    expect(f.meta.kind).toBe("json");
  });

  it("can be pinned to a TypeScript type via the generic", () => {
    const f = json<{ ok: boolean }>();
    expect(decodeSync(f, { ok: true })).toEqual({ ok: true });
  });
});
