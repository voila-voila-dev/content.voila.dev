import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { id } from "./id";

describe("fields.id", () => {
  it("decodes a UUID and is unique by default", () => {
    const f = id();
    const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(decodeSync(f, uuid)).toBe(uuid);
    expect(f.meta.kind).toBe("id");
    expect(f.meta.unique).toBe(true);
    expect(f.meta.format).toBe("uuid");
  });

  it("rejects a non-UUID string", () => {
    const f = id();
    expect(() => decodeSync(f, "123")).toThrow();
  });
});
