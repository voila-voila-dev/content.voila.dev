import { describe, expect, it } from "bun:test";
import { decodeSync, type Infer } from "../std";
import { string } from "./string";

describe("fields.string", () => {
  it("type is `string` when not localized", () => {
    const f = string({ max: 100 });
    type T = Infer<typeof f>;
    const x: T = "hello";
    expect(typeof x).toBe("string");
  });

  it("localized field accepts any BCP 47 key in its wide form", () => {
    const f = string({ localized: true });
    // Pre-defineConfig the wide form validates any string key; the decoded
    // value preserves whichever subset of keys was provided.
    const decoded = decodeSync(f, { "en-US": "hi", "fr-FR": "salut" }) as Record<string, string>;
    expect(decoded["en-US"]).toBe("hi");
    expect(decoded["fr-FR"]).toBe("salut");
  });
});
