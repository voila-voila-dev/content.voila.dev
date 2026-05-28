import { describe, expect, it } from "bun:test";
import { defineConfig } from "../config";
import { defineCollection } from "./collection";
import * as fields from "./fields";
import type { InferDoc, InferSingleton } from "./infer";
import { defineSingleton } from "./singleton";

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string({ localized: true, max: 200 }),
    views: fields.number({ integer: true }),
    cover: fields.media({ accept: ["image/*"] }),
    gallery: fields.array(fields.media({ accept: ["image/*"] })),
    publishedAt: fields.datetime(),
  },
});

const settings = defineSingleton({
  slug: "settings",
  fields: {
    siteName: fields.string({ localized: true }),
    primaryColor: fields.color({ format: "hex" }),
  },
});

const config = defineConfig({
  branding: { name: "Acme" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  collections: { posts },
  singletons: { settings },
});

// Helper: compile-time assertion that `A` and `B` are mutually assignable.
type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

describe("InferDoc", () => {
  it("resolves each field to its decoded Type, narrowing localized fields", () => {
    type Post = InferDoc<typeof config, "posts">;

    // Localized field narrowed to the selected locales; plain fields pass through.
    type _NarrowsLocalized = Expect<
      Equal<Post["title"], { readonly "en-US": string; readonly "fr-FR": string }>
    >;
    type _Number = Expect<Equal<Post["views"], number>>;
    type _DateTime = Expect<Equal<Post["publishedAt"], Date>>;

    // A single `media` field is one file; galleries come from `array(media())`.
    type _Cover = Expect<Equal<Post["cover"], fields.MediaValue>>;
    type _Gallery = Expect<Equal<Post["gallery"], ReadonlyArray<fields.MediaValue>>>;

    // A value of the inferred shape is assignable — proves the type is concrete.
    const file: fields.MediaValue = {
      id: "11111111-1111-1111-1111-111111111111",
      url: "https://example.com/x.png",
      mime: "image/png",
      size: 10,
    };
    const doc: Post = {
      title: { "en-US": "Hello", "fr-FR": "Bonjour" },
      views: 3,
      cover: file,
      gallery: [file],
      publishedAt: new Date(0),
    };
    expect(doc.title["fr-FR"]).toBe("Bonjour");
    expect(doc.views).toBe(3);
  });

  it("resolves singleton documents too", () => {
    type Settings = InferSingleton<typeof config, "settings">;
    type _SiteName = Expect<
      Equal<Settings["siteName"], { readonly "en-US": string; readonly "fr-FR": string }>
    >;
    type _Color = Expect<Equal<Settings["primaryColor"], string>>;

    const doc: Settings = {
      siteName: { "en-US": "Acme", "fr-FR": "Acme" },
      primaryColor: "#ffffff",
    };
    expect(doc.primaryColor).toBe("#ffffff");
  });
});
