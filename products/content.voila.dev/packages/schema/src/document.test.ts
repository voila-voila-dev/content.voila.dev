import { describe, expect, test } from "bun:test";
import { zodAdapter } from "./adapters/zod.ts";
import { buildFieldValidators, validateDocument } from "./document.ts";
import { number } from "./fields/number.ts";
import { select } from "./fields/select.ts";
import { slug } from "./fields/slug.ts";
import { string } from "./fields/string.ts";

const fields = {
  title: string({ required: true, min: 3 }),
  status: select({ required: true, options: ["draft", "published"] }),
  permalink: slug({ from: "title" }),
  views: number({ default: 0 }),
};

describe("buildFieldValidators", () => {
  test("returns one Standard Schema per field, keyed by name", () => {
    const validators = buildFieldValidators(fields, zodAdapter);
    expect(Object.keys(validators).sort()).toEqual(["permalink", "status", "title", "views"]);
    for (const v of Object.values(validators)) {
      expect(typeof v["~standard"].validate).toBe("function");
    }
  });
});

describe("validateDocument", () => {
  test("accepts a valid document and applies defaults", async () => {
    const result = await validateDocument(
      fields,
      { title: "Hello", status: "draft", permalink: "hello" },
      zodAdapter,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.value.title).toBe("Hello");
      expect(result.value.views).toBe(0); // default applied
      expect(result.value.permalink).toBe("hello");
    }
  });

  test("collects per-field errors keyed by field name", async () => {
    const result = await validateDocument(
      fields,
      { title: "no", status: "archived", permalink: "Not A Slug" },
      zodAdapter,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(Object.keys(result.errors).sort()).toEqual(["permalink", "status", "title"]);
      expect((result.errors.title ?? []).length).toBeGreaterThan(0);
    }
  });

  test("treats a missing required field as an error", async () => {
    const result = await validateDocument(fields, { status: "draft" }, zodAdapter);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors.title).toBeDefined();
  });

  test("drops empty optionals from the parsed value", async () => {
    const result = await validateDocument(
      fields,
      { title: "Hello", status: "draft", permalink: "" },
      zodAdapter,
    );
    expect(result.valid).toBe(true);
    if (result.valid) expect("permalink" in result.value).toBe(false);
  });

  test("ignores unknown input keys", async () => {
    const result = await validateDocument(
      fields,
      { title: "Hello", status: "draft", rogue: "x" },
      zodAdapter,
    );
    expect(result.valid).toBe(true);
    if (result.valid) expect("rogue" in result.value).toBe(false);
  });

  test("tolerates a null/undefined input", async () => {
    const result = await validateDocument(fields, undefined, zodAdapter);
    expect(result.valid).toBe(false); // required fields missing
    if (!result.valid) expect(result.errors.title).toBeDefined();
  });
});
