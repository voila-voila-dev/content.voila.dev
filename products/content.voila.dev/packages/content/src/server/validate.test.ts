import { describe, expect, test } from "bun:test";
import { number, select, slug, string } from "@voila/content-schema";
import { errorResponse } from "./errors.ts";
import { validateWrite } from "./validate.ts";

const collection = {
  slug: "posts",
  fields: {
    title: string({ required: true, min: 3 }),
    status: select({ required: true, options: ["draft", "published"] }),
    permalink: slug({ from: "title" }),
    views: number({ default: 0 }),
  },
};

describe("validateWrite", () => {
  test("returns the parsed value on success (defaults applied)", async () => {
    const result = await validateWrite(collection, { title: "Hello", status: "draft" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Hello");
      expect(result.value.views).toBe(0);
    }
  });

  test("returns a VALIDATION failure with per-field messages", async () => {
    const result = await validateWrite(collection, { title: "no", status: "archived" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.collectionSlug).toBe("posts");
      expect(result.error.fields.title).toBeDefined();
      expect(result.error.fields.status).toBeDefined();
      expect((result.error.fields.title ?? []).length).toBeGreaterThan(0);
    }
  });

  test("serializes to a 422 envelope the client can map back onto fields", async () => {
    const result = await validateWrite(collection, { status: "draft" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const res = errorResponse(result.error);
      expect(res.status).toBe(422);
      const body = (await res.json()) as {
        error: { code: string; fields: Record<string, string[]> };
      };
      expect(body.error.code).toBe("VALIDATION");
      expect(body.error.fields.title).toBeDefined();
    }
  });
});
