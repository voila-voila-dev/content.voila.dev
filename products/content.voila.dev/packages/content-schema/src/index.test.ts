import { describe, expect, it } from "bun:test";
import {
  boolean,
  defineField,
  getFieldMeta,
  number,
  Schema,
  select,
  slug,
  standardSchemaV1,
  string,
  VoilaField,
} from "./index.ts";

describe("@voila/content-schema public surface", () => {
  it("re-exports the field constructors and the Schema namespace", () => {
    expect(typeof string).toBe("function");
    expect(typeof number).toBe("function");
    expect(typeof boolean).toBe("function");
    expect(typeof slug).toBe("function");
    expect(typeof select).toBe("function");
    expect(typeof defineField).toBe("function");
    expect(typeof getFieldMeta).toBe("function");
    expect(typeof VoilaField).toBe("symbol");
    expect(Schema.String).toBeDefined();
  });

  it("exposes Schema.standardSchemaV1 as a top-level export", () => {
    const f = string({ min: 1 });
    const std = standardSchemaV1(f);
    expect(std["~standard"].vendor).toBe("effect");
    // Smoke: synchronous validate path on a passing input.
    const result = std["~standard"].validate("hi");
    // The contract returns either {value} or {issues}, possibly as a Promise.
    if (result instanceof Promise) {
      // Should not happen for a sync schema, but guard anyway.
      throw new Error("Expected synchronous result");
    }
    expect("value" in result ? result.value : null).toBe("hi");
  });

  it("standardSchemaV1 reports issues for invalid input", () => {
    const f = string({ min: 5 });
    const std = standardSchemaV1(f);
    const result = std["~standard"].validate("hi");
    if (result instanceof Promise) {
      throw new Error("Expected synchronous result");
    }
    expect("issues" in result && Array.isArray(result.issues)).toBe(true);
  });
});
