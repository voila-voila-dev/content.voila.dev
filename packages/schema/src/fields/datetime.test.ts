import { describe, expect, test } from "bun:test";
import { datetime } from "./datetime.ts";

describe("datetime", () => {
  test("returns a datetime FieldDef", () => {
    expect(datetime()).toEqual({ kind: "datetime" });
  });
});
