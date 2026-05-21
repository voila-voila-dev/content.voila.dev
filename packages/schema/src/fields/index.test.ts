import { describe, expect, test } from "bun:test";
import { fields } from "./index.ts";

describe("fields registry", () => {
  test("exposes every primitive constructor", () => {
    expect(Object.keys(fields).sort()).toEqual([
      "boolean",
      "date",
      "datetime",
      "json",
      "number",
      "string",
    ]);
  });

  test("kind discriminator is set on every constructor", () => {
    expect(fields.string().kind).toBe("string");
    expect(fields.number().kind).toBe("number");
    expect(fields.boolean().kind).toBe("boolean");
    expect(fields.date().kind).toBe("date");
    expect(fields.datetime().kind).toBe("datetime");
    expect(fields.json().kind).toBe("json");
  });
});
