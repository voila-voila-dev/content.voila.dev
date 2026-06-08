import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { secret } from "./secret";

describe("fields.secret", () => {
  it("decodes a string and is hidden by default", () => {
    const f = secret();
    expect(decodeSync(f, "sk_live_123")).toBe("sk_live_123");
    expect(f.meta.kind).toBe("secret");
    expect(f.meta.hidden).toBe(true);
  });
});
