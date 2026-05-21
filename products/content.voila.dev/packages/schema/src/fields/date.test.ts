import { describe, expect, test } from "bun:test";
import { date } from "./date.ts";

describe("date", () => {
  test("returns a date FieldDef", () => {
    expect(date()).toEqual({ kind: "date" });
  });
});
