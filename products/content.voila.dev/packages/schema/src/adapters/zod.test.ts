import { describe, expect, test } from "bun:test";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { boolean } from "../fields/boolean.ts";
import { date } from "../fields/date.ts";
import { datetime } from "../fields/datetime.ts";
import { json } from "../fields/json.ts";
import { number } from "../fields/number.ts";
import { string } from "../fields/string.ts";
import { toValidator } from "../validator.ts";
import { zodAdapter } from "./zod.ts";

async function run(schema: StandardSchemaV1, value: unknown) {
  return await schema["~standard"].validate(value);
}

describe("zodAdapter — string", () => {
  test("accepts a valid string", async () => {
    const v = toValidator(string({ required: true }), zodAdapter);
    expect(await run(v, "hello")).toEqual({ value: "hello" });
  });

  test("rejects below min", async () => {
    const v = toValidator(string({ required: true, min: 3 }), zodAdapter);
    const result = await run(v, "ab");
    expect(result.issues).toBeDefined();
  });

  test("rejects above max", async () => {
    const v = toValidator(string({ required: true, max: 2 }), zodAdapter);
    const result = await run(v, "abcd");
    expect(result.issues).toBeDefined();
  });

  test("enforces pattern", async () => {
    const v = toValidator(string({ required: true, pattern: /^[a-z]+$/ }), zodAdapter);
    expect((await run(v, "abc")).issues).toBeUndefined();
    expect((await run(v, "ABC")).issues).toBeDefined();
  });

  test("format email", async () => {
    const v = toValidator(string({ required: true, format: "email" }), zodAdapter);
    expect((await run(v, "a@b.com")).issues).toBeUndefined();
    expect((await run(v, "nope")).issues).toBeDefined();
  });

  test("format url", async () => {
    const v = toValidator(string({ required: true, format: "url" }), zodAdapter);
    expect((await run(v, "https://example.com")).issues).toBeUndefined();
    expect((await run(v, "not a url")).issues).toBeDefined();
  });

  test("format uuid", async () => {
    const v = toValidator(string({ required: true, format: "uuid" }), zodAdapter);
    expect((await run(v, "123e4567-e89b-12d3-a456-426614174000")).issues).toBeUndefined();
    expect((await run(v, "nope")).issues).toBeDefined();
  });

  test("optional when not required", async () => {
    const v = toValidator(string({}), zodAdapter);
    expect((await run(v, undefined)).issues).toBeUndefined();
  });

  test("applies default", async () => {
    const v = toValidator(string({ default: "hi" }), zodAdapter);
    const result = await run(v, undefined);
    expect(result.issues).toBeUndefined();
    if (!result.issues) expect(result.value).toBe("hi");
  });

  test("applies function default", async () => {
    let counter = 0;
    const v = toValidator(string({ default: () => `gen-${++counter}` }), zodAdapter);
    const first = await run(v, undefined);
    const second = await run(v, undefined);
    expect(first.issues).toBeUndefined();
    expect(second.issues).toBeUndefined();
    if (!first.issues) expect(first.value).toBe("gen-1");
    if (!second.issues) expect(second.value).toBe("gen-2");
  });
});

describe("zodAdapter — number", () => {
  test("accepts a number", async () => {
    const v = toValidator(number({ required: true }), zodAdapter);
    expect((await run(v, 3.14)).issues).toBeUndefined();
  });

  test("rejects non-integer when integer", async () => {
    const v = toValidator(number({ required: true, integer: true }), zodAdapter);
    expect((await run(v, 1.5)).issues).toBeDefined();
    expect((await run(v, 2)).issues).toBeUndefined();
  });

  test("enforces min/max", async () => {
    const v = toValidator(number({ required: true, min: 1, max: 10 }), zodAdapter);
    expect((await run(v, 0)).issues).toBeDefined();
    expect((await run(v, 11)).issues).toBeDefined();
    expect((await run(v, 5)).issues).toBeUndefined();
  });

  test("step enforces multipleOf", async () => {
    const v = toValidator(number({ required: true, step: 0.5 }), zodAdapter);
    expect((await run(v, 0.5)).issues).toBeUndefined();
    expect((await run(v, 0.3)).issues).toBeDefined();
  });
});

describe("zodAdapter — boolean", () => {
  test("accepts true/false", async () => {
    const v = toValidator(boolean({ required: true }), zodAdapter);
    expect((await run(v, true)).issues).toBeUndefined();
    expect((await run(v, false)).issues).toBeUndefined();
    expect((await run(v, "true")).issues).toBeDefined();
  });
});

describe("zodAdapter — date / datetime", () => {
  test("date accepts ISO yyyy-mm-dd", async () => {
    const v = toValidator(date({ required: true }), zodAdapter);
    expect((await run(v, "2026-05-21")).issues).toBeUndefined();
    expect((await run(v, "2026/05/21")).issues).toBeDefined();
  });

  test("datetime accepts ISO 8601 with offset", async () => {
    const v = toValidator(datetime({ required: true }), zodAdapter);
    expect((await run(v, "2026-05-21T10:30:00Z")).issues).toBeUndefined();
    expect((await run(v, "2026-05-21T10:30:00+02:00")).issues).toBeUndefined();
    expect((await run(v, "not a date")).issues).toBeDefined();
  });
});

describe("zodAdapter — json", () => {
  test("accepts any value", async () => {
    const v = toValidator(json({ required: true }), zodAdapter);
    expect((await run(v, { foo: 1 })).issues).toBeUndefined();
    expect((await run(v, [1, 2, 3])).issues).toBeUndefined();
    expect((await run(v, "string")).issues).toBeUndefined();
  });
});

describe("zodAdapter — unsupported kind", () => {
  test("throws", () => {
    expect(() =>
      zodAdapter({ kind: "mystery" } as unknown as Parameters<typeof zodAdapter>[0]),
    ).toThrow(/unsupported field kind/);
  });
});
