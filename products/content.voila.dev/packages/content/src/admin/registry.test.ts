import { describe, expect, test } from "bun:test";
import { defineCollection, defineContent, defineSingleton } from "../define.ts";
import { getCollection, getSingleton } from "./registry.ts";

describe("getCollection / getSingleton", () => {
  const content = defineContent({
    collections: [defineCollection({ slug: "posts", fields: {} })],
    singletons: [defineSingleton({ slug: "config", fields: {} })],
  });

  test("resolves known slugs", () => {
    expect(getCollection(content, "posts")?.slug).toBe("posts");
    expect(getSingleton(content, "config")?.slug).toBe("config");
  });

  test("returns undefined for unknown slugs", () => {
    expect(getCollection(content, "missing")).toBeUndefined();
    expect(getSingleton(content, "missing")).toBeUndefined();
  });
});
