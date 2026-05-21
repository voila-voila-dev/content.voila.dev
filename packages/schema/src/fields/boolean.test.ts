import { describe, expect, test } from "bun:test";
import { boolean } from "./boolean.ts";

describe("boolean", () => {
  test("returns a boolean FieldDef", () => {
    expect(boolean()).toEqual({ kind: "boolean" });
  });

  test("preserves default", () => {
    expect(boolean({ default: false }).default).toBe(false);
  });
});
