import { describe, expect, test } from "bun:test";
import { string } from "@voila/content-schema";
import { defineCollection, defineContent, defineSingleton } from "./define.ts";

describe("defineCollection", () => {
  test("tags the result with kind=collection", () => {
    const posts = defineCollection({
      slug: "posts",
      label: "Posts",
      fields: { title: string({ required: true }) },
    });
    expect(posts.kind).toBe("collection");
    expect(posts.slug).toBe("posts");
    expect(posts.label).toBe("Posts");
    expect(posts.fields.title.kind).toBe("string");
  });

  test("preserves passed-in properties verbatim", () => {
    const c = defineCollection({
      slug: "authors",
      label: "Authors",
      icon: "User",
      description: "People who write posts.",
      fields: { name: string({ required: true }) },
    });
    expect(c.icon).toBe("User");
    expect(c.description).toBe("People who write posts.");
  });
});

describe("defineSingleton", () => {
  test("tags the result with kind=singleton", () => {
    const settings = defineSingleton({
      slug: "site-settings",
      fields: { title: string() },
    });
    expect(settings.kind).toBe("singleton");
    expect(settings.slug).toBe("site-settings");
  });
});

describe("defineContent", () => {
  test("works with no arguments", () => {
    const content = defineContent();
    expect(content.mount.admin).toBe("/admin");
    expect(content.mount.api).toBe("/admin/api");
    expect(content.mount.mcp).toBe("/admin/mcp");
  });

  test("fills in default branding to an empty object", () => {
    const content = defineContent();
    expect(content.branding).toEqual({});
  });

  test("overrides mount paths from config", () => {
    const content = defineContent({
      mount: { admin: "/studio", api: "/studio/api", mcp: "/studio/mcp" },
    });
    expect(content.mount).toEqual({
      admin: "/studio",
      api: "/studio/api",
      mcp: "/studio/mcp",
    });
  });

  test("normalizes trailing slashes off mount paths", () => {
    const content = defineContent({
      mount: { admin: "/studio/", api: "/studio/api/" },
    });
    expect(content.mount.admin).toBe("/studio");
    expect(content.mount.api).toBe("/studio/api");
  });

  test("rejects mount paths that do not start with /", () => {
    expect(() => defineContent({ mount: { admin: "studio" } })).toThrow(/must start with/);
  });

  test("freezes the collections and singletons arrays", () => {
    const content = defineContent();
    expect(Object.isFrozen(content.collections)).toBe(true);
    expect(Object.isFrozen(content.singletons)).toBe(true);
  });

  test("exposes branding, collections, and singletons", () => {
    const posts = defineCollection({ slug: "posts", fields: { title: string() } });
    const settings = defineSingleton({ slug: "settings", fields: { title: string() } });
    const content = defineContent({
      branding: { name: "Acme" },
      collections: [posts],
      singletons: [settings],
    });
    expect(content.branding.name).toBe("Acme");
    expect(content.collections).toHaveLength(1);
    expect(content.singletons).toHaveLength(1);
    expect(content.collections[0]?.slug).toBe("posts");
    expect(content.singletons[0]?.slug).toBe("settings");
  });

  test("returns a plain config object (no handle method)", () => {
    const content = defineContent();
    expect("handle" in content).toBe(false);
  });
});
