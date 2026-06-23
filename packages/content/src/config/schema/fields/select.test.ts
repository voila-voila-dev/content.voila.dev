import { describe, expect, it } from "bun:test";
import { decodeSync } from "../std";
import { select } from "./select";

describe("fields.select", () => {
  it("decodes one of the options", () => {
    const f = select({ options: ["sm", "md", "lg"] });
    expect(decodeSync(f, "md")).toBe("md");
    expect(f.meta.kind).toBe("select");
    expect(f.meta.options).toEqual(["sm", "md", "lg"]);
  });

  it("rejects a value outside the options", () => {
    const f = select({ options: ["sm"] });
    expect(() => decodeSync(f, "xl")).toThrow();
  });

  it("throws when constructed with no options", () => {
    expect(() => select({ options: [] })).toThrow(/at least one option/);
  });
});
