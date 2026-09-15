import { describe, expect, test } from "bun:test";
import { defineCollection, defineConfig, defineSingleton, fields } from "@voila/content";
import { buildNav } from "./nav";

const config = defineConfig({
  branding: { name: "Acme" },
  collections: {
    posts: defineCollection({ slug: "posts", fields: { title: fields.string() } }),
    teamMembers: defineCollection({
      slug: "team-members",
      label: "The Team",
      fields: { name: fields.string() },
    }),
  },
  singletons: {
    settings: defineSingleton({ slug: "settings", fields: { siteName: fields.string() } }),
  },
});

describe("buildNav", () => {
  test("maps collections and singletons to items in declaration order", () => {
    const nav = buildNav(config);
    expect(nav.collections.map((i) => i.slug)).toEqual(["posts", "team-members"]);
    expect(nav.singletons.map((i) => i.slug)).toEqual(["settings"]);
    expect(nav.collections[0]?.kind).toBe("collection");
    expect(nav.singletons[0]?.kind).toBe("singleton");
  });

  test("uses label when set, else humanizes the slug", () => {
    const nav = buildNav(config);
    expect(nav.collections[0]?.label).toBe("Posts");
    expect(nav.collections[1]?.label).toBe("The Team");
  });

  test("hrefs default to /admin/<slug>", () => {
    const nav = buildNav(config);
    expect(nav.collections[0]?.href).toBe("/admin/posts");
    expect(nav.singletons[0]?.href).toBe("/admin/settings");
  });

  test("honors a custom basePath and strips its trailing slash", () => {
    expect(buildNav(config, { basePath: "/cms" }).collections[0]?.href).toBe("/cms/posts");
    expect(buildNav(config, { basePath: "/cms/" }).collections[0]?.href).toBe("/cms/posts");
  });

  test("marks the exact path active", () => {
    const nav = buildNav(config, { currentPath: "/admin/posts" });
    expect(nav.collections[0]?.isActive).toBe(true);
    expect(nav.collections[1]?.isActive).toBe(false);
  });

  test("marks a nested detail path active for its collection", () => {
    const nav = buildNav(config, { currentPath: "/admin/posts/123" });
    expect(nav.collections[0]?.isActive).toBe(true);
  });

  test("does not mark a sibling whose href is a string prefix", () => {
    const nav = buildNav(config, { currentPath: "/admin/posts-archive" });
    expect(nav.collections[0]?.isActive).toBe(false);
  });

  test("nothing active without a currentPath", () => {
    const nav = buildNav(config);
    expect(nav.collections.every((i) => !i.isActive)).toBe(true);
  });

  test("empty groups when the config has none", () => {
    const bare = defineConfig({ branding: { name: "Bare" } });
    const nav = buildNav(bare);
    expect(nav.collections).toEqual([]);
    expect(nav.singletons).toEqual([]);
  });
});

describe("buildNav — layout groups", () => {
  const laid = defineConfig({
    branding: { name: "Acme" },
    collections: {
      cities: defineCollection({ slug: "cities", group: "Territory", fields: {} }),
      pages: defineCollection({ slug: "pages", fields: {} }),
      posts: defineCollection({ slug: "posts", group: "Blog", fields: {} }),
      admins: defineCollection({ slug: "admins", fields: {} }),
    },
    singletons: {
      settings: defineSingleton({ slug: "settings", fields: {} }),
    },
  });

  test("listed entities follow the layout; the rest keep their own group and order", () => {
    const nav = buildNav(laid, {
      groups: [
        { label: "Content", items: ["pages", "posts"] },
        { label: "Agency", items: ["settings", "admins", "nope"] },
      ],
    });
    expect(nav.groups.map((g) => [g.label, g.items.map((i) => i.slug)])).toEqual([
      ["Content", ["pages", "posts"]],
      ["Agency", ["settings", "admins"]],
      ["Territory", ["cities"]],
    ]);
    expect(nav.collections.map((i) => i.slug)).toEqual(["pages", "posts", "admins", "cities"]);
  });

  test("an empty layout is the declaration order", () => {
    expect(buildNav(laid, { groups: [] }).groups.map((g) => g.label)).toEqual([
      "Territory",
      "Collections",
      "Blog",
      "Content",
    ]);
  });
});
