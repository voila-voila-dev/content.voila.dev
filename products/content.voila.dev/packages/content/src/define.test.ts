import { describe, expect, test } from "bun:test";
import { string } from "@voila/content-schema";
import { defineCollection, defineContent, defineSingleton, resolveConfig } from "./define.ts";

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

describe("resolveConfig", () => {
  test("fills in default mount paths", () => {
    const resolved = resolveConfig({});
    expect(resolved.mount.admin).toBe("/admin");
    expect(resolved.mount.api).toBe("/admin/api");
    expect(resolved.mount.mcp).toBe("/admin/mcp");
  });

  test("overrides mount paths from config", () => {
    const resolved = resolveConfig({
      mount: { admin: "/studio", api: "/studio/api", mcp: "/studio/mcp" },
    });
    expect(resolved.mount).toEqual({
      admin: "/studio",
      api: "/studio/api",
      mcp: "/studio/mcp",
    });
  });

  test("normalizes trailing slashes off mount paths", () => {
    const resolved = resolveConfig({
      mount: { admin: "/studio/", api: "/studio/api/" },
    });
    expect(resolved.mount.admin).toBe("/studio");
    expect(resolved.mount.api).toBe("/studio/api");
  });

  test("rejects mount paths that do not start with /", () => {
    expect(() => resolveConfig({ mount: { admin: "studio" } })).toThrow(/must start with/);
  });

  test("defaults branding to an empty object", () => {
    const resolved = resolveConfig({});
    expect(resolved.branding).toEqual({});
  });

  test("freezes the collections and singletons arrays", () => {
    const resolved = resolveConfig({});
    expect(Object.isFrozen(resolved.collections)).toBe(true);
    expect(Object.isFrozen(resolved.singletons)).toBe(true);
  });
});

describe("defineContent", () => {
  test("returns an object with a handle function", () => {
    const content = defineContent();
    expect(typeof content.handle).toBe("function");
  });

  test("works with no arguments", () => {
    const content = defineContent();
    expect(content.mount.admin).toBe("/admin");
  });

  test("exposes the resolved mount paths on the returned object", () => {
    const content = defineContent({ mount: { admin: "/studio" } });
    expect(content.mount.admin).toBe("/studio");
    expect(content.mount.api).toBe("/admin/api");
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
});
