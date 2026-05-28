// One config touching every field kind the DDL layer knows how to render —
// drives both the golden snapshots and the derive-schema asserts. Kept
// separate from the tests so adding a field kind is a one-file change.

import { defineConfig } from "../../config/config";
import { defineCollection } from "../../config/schema/collection";
import * as fields from "../../config/schema/fields";
import { defineSingleton } from "../../config/schema/singleton";

const Role = { Admin: "admin", Editor: "editor" } as const;

const everything = defineCollection({
  slug: "everything",
  fields: {
    // Primitives + localized variant
    title: fields.string({ required: true, max: 200 }),
    titleLocalized: fields.string({ localized: true }),
    count: fields.number({ integer: true, required: true }),
    weight: fields.number(),
    isPublished: fields.boolean({ required: true }),
    publishedDate: fields.date(),
    publishedAt: fields.datetime({ required: true }),
    schedule: fields.time(),
    runtime: fields.duration(),
    // Identifiers + selections
    slug: fields.slug({ from: "title" }),
    status: fields.select({ options: ["draft", "published"], required: true }),
    tags: fields.multiSelect({ options: ["news", "tutorial", "release"] }),
    role: fields.enum({ values: Role }),
    primaryColor: fields.color({ format: "hex" }),
    // Long text variants
    body: fields.markdown(),
    snippet: fields.code({ language: "ts" }),
    secretToken: fields.secret(),
    passwordHash: fields.password(),
    // Structured / JSON-shaped values
    metadata: fields.json(),
    sections: fields.array(fields.string()),
    seo: fields.object({ title: fields.string(), description: fields.string() }),
    cover: fields.media({ accept: ["image/*"] }),
    blocks: fields.richText(),
    related: fields.polymorphic({ to: ["everything", "settings"] }),
    // Relations
    authorId: fields.relation({ to: "authors" }),
    contributors: fields.relation({ to: "authors", many: true }),
    // Position
    sortKey: fields.position(),
  },
});

const settings = defineSingleton({
  slug: "settings",
  fields: {
    siteName: fields.string({ localized: true }),
    primaryColor: fields.color({ format: "hex" }),
  },
});

export const allFieldsConfig = defineConfig({
  branding: { name: "Acme" },
  i18n: { locales: ["en-US", "fr-FR"], defaultLocale: "en-US" },
  collections: { everything },
  singletons: { settings },
});
