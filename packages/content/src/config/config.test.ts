import { describe, expect, it } from "bun:test";
import { defineConfig } from "./config";
import { defineCollection } from "./schema/collection";
import * as fields from "./schema/fields";
import { defineSingleton } from "./schema/singleton";
import { decodeSync, type Infer } from "./schema/std";

describe("defineConfig", () => {
  const posts = defineCollection({
    slug: "posts",
    label: "Posts",
    fields: {
      title: fields.string({ localized: true, max: 200 }),
      slug: fields.slug({ from: "title" }),
      body: fields.richText({ localized: true }),
      publishedAt: fields.datetime(),
    },
  });

  const authors = defineCollection({
    slug: "authors",
    fields: {
      name: fields.string({ max: 100 }),
      bio: fields.markdown({ localized: true }),
      avatar: fields.media({ accept: ["image/*"] }),
    },
  });

  const settings = defineSingleton({
    slug: "settings",
    fields: {
      siteName: fields.string({ localized: true }),
      primaryColor: fields.color({ format: "hex" }),
    },
  });

  it("exposes collections and singletons keyed by slug", () => {
    const config = defineConfig({
      branding: { name: "Acme" },
      i18n: {
        locales: ["en-US", "fr-FR"],
        defaultLocale: "en-US",
        fallback: { "fr-FR": ["en-US"] },
      },
      collections: { posts, authors },
      singletons: { settings },
    });
    expect(config.branding.name).toBe("Acme");
    expect(config.collections.posts.slug).toBe("posts");
    expect(config.collections.authors.slug).toBe("authors");
    expect(config.singletons.settings.slug).toBe("settings");
  });

  it("carries titleField through to the normalized collection", () => {
    const titled = defineCollection({
      slug: "pages",
      titleField: "name",
      fields: { name: fields.string() },
    });
    const config = defineConfig({ branding: { name: "Acme" }, collections: { titled } });
    expect(config.collections.titled.titleField).toBe("name");
    // @ts-expect-error — titleField must name a declared field.
    void defineCollection({ slug: "bad", titleField: "nope", fields: { name: fields.string() } });
  });

  it("carries groups through locale narrowing on collections and singletons", () => {
    const grouped = defineCollection({
      slug: "grouped",
      fields: { title: fields.string({ localized: true }), seo: fields.string() },
      groups: [
        { id: "content", icon: "FileText", fields: ["title"] },
        { id: "meta", label: "Metadata", fields: ["seo"] },
      ],
    });
    const groupedSettings = defineSingleton({
      slug: "groupedSettings",
      fields: { siteName: fields.string({ localized: true }), themeColor: fields.color() },
      groups: [{ id: "branding", fields: ["siteName", "themeColor"] }],
    });
    const config = defineConfig({
      branding: { name: "Acme" },
      i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
      collections: { grouped },
      singletons: { groupedSettings },
    });
    // `groups` survives the `NarrowCollection`/`NarrowSingleton` rewrite — a
    // static member access (no `?.`) proves the type preserves it after narrowing.
    expect(config.collections.grouped.groups?.[0]?.id).toBe("content");
    expect(config.collections.grouped.groups?.[1]?.label).toBe("Metadata");
    expect(config.singletons.groupedSettings.groups?.[0]?.fields).toEqual([
      "siteName",
      "themeColor",
    ]);
    void defineCollection({
      slug: "bad2",
      fields: { name: fields.string() },
      // @ts-expect-error — a group's field key must name a declared field.
      groups: [{ id: "g", fields: ["nope"] }],
    });
    void defineSingleton({
      slug: "bad3",
      fields: { name: fields.string() },
      // @ts-expect-error — singleton group keys are checked too.
      groups: [{ id: "g", fields: ["nope"] }],
    });
  });

  it("narrows localized fields' runtime schema to the selected locales", () => {
    const config = defineConfig({
      branding: { name: "Acme" },
      i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
      collections: { posts },
    });
    const title = config.collections.posts.fields.title;

    // Type-level: the narrowed field's output is
    // { readonly "en-US": string; readonly "fr-FR": string }. The probe below
    // would fail to typecheck if the narrowing regressed.
    type T = Infer<typeof title>;
    const _typeProbe: T = { "en-US": "Hi", "fr-FR": "Salut" };
    expect(_typeProbe["fr-FR"]).toBe("Salut");

    // Runtime: an unselected locale is rejected, selected ones are accepted.
    expect(decodeSync(title, { "en-US": "Hi", "fr-FR": "Salut" })).toEqual({
      "en-US": "Hi",
      "fr-FR": "Salut",
    });
    expect(() => decodeSync(title, { "de-DE": "Hallo" })).toThrow();
  });
});
