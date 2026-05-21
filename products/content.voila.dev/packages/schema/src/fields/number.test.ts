import { describe, expect, test } from "bun:test";
import { number } from "./number.ts";

describe("number", () => {
  test("returns a number FieldDef with no options", () => {
    expect(number()).toEqual({ kind: "number" });
  });

  test("preserves type-specific options", () => {
    const field = number({ min: 0, max: 100, integer: true, step: 5 });
    expect(field).toEqual({
      kind: "number",
      min: 0,
      max: 100,
      integer: true,
      step: 5,
    });
  });
});
