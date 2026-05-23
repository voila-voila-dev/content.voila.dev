import { describe, expect, test } from "bun:test";
import { string } from "./fields/string.ts";
import type { AnyFieldDef } from "./types.ts";
import { toValidator, type ValidatorAdapter } from "./validator.ts";

describe("toValidator", () => {
  test("delegates to the adapter for the given field", () => {
    const seen: AnyFieldDef[] = [];
    const adapter: ValidatorAdapter = (field) => {
      seen.push(field);
      return {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: () => ({ value: "ok" }),
        },
      };
    };
    const field = string({ required: true });
    const v = toValidator(field, adapter);
    expect(seen[0]).toBe(field);
    expect(v["~standard"].vendor).toBe("test");
    expect(v["~standard"].version).toBe(1);
  });

  test("any adapter satisfying ValidatorAdapter is accepted (Standard Schema contract)", async () => {
    const customAdapter: ValidatorAdapter = (field) => ({
      "~standard": {
        version: 1,
        vendor: "custom",
        validate: (value) =>
          typeof value === "string"
            ? { value }
            : { issues: [{ message: `expected string for ${field.kind}` }] },
      },
    });
    const v = toValidator(string({ required: true }), customAdapter);
    const ok = await v["~standard"].validate("hi");
    const bad = await v["~standard"].validate(42);
    expect(ok).toEqual({ value: "hi" });
    expect(bad.issues?.[0]?.message).toContain("expected string for string");
  });
});
