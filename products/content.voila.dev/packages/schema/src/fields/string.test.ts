import { describe, expect, test } from "bun:test";
import { string } from "./string.ts";

describe("string", () => {
  test("returns a string FieldDef with no options", () => {
    expect(string()).toEqual({ kind: "string" });
  });

  test("preserves type-specific options", () => {
    const pattern = /^[a-z]+$/;
    const field = string({ min: 1, max: 10, pattern, format: "email" });
    expect(field).toEqual({
      kind: "string",
      min: 1,
      max: 10,
      pattern,
      format: "email",
    });
  });

  test("preserves base FieldDef options", () => {
    const field = string({ required: true, unique: true, localized: true });
    expect(field.required).toBe(true);
    expect(field.unique).toBe(true);
    expect(field.localized).toBe(true);
  });

  test("kind cannot be overridden by caller options", () => {
    const field = string({ ...({ kind: "number" } as unknown as object) });
    expect(field.kind).toBe("string");
  });
});
