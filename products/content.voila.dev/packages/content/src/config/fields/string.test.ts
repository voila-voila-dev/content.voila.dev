import { describe, expect, it } from "bun:test";
import { Schema } from "effect";
import { string } from "./string";

describe("fields.string", () => {
  it("type is `string` when not localized", () => {
    const f = string({ max: 100 });
    type T = Schema.Schema.Type<typeof f>;
    const x: T = "hello";
    expect(typeof x).toBe("string");
  });

  it("localized field accepts any BCP 47 key in its wide form", () => {
    const f = string({ localized: true });
    // Pre-defineConfig the runtime validates the full Locale union. The decoded
    // value preserves whichever subset of keys was provided.
    const decoded = Schema.decodeUnknownSync(f)({ "en-US": "hi", "fr-FR": "salut" }) as Record<
      string,
      string
    >;
    expect(decoded["en-US"]).toBe("hi");
    expect(decoded["fr-FR"]).toBe("salut");
  });
});
