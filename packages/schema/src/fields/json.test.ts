import { describe, expect, test } from "bun:test";
import { json } from "./json.ts";

describe("json", () => {
  test("returns a json FieldDef", () => {
    expect(json()).toEqual({ kind: "json" });
  });

  test("carries the generic through default", () => {
    type Shape = { count: number };
    const field = json<Shape>({ default: { count: 0 } });
    expect(field.default).toEqual({ count: 0 });
  });
});
