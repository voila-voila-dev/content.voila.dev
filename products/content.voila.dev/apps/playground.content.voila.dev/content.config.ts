import { defineCollection, defineContent, defineSingleton, fields } from "@voila/content";

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  fields: {
    title: fields.string({ required: true, max: 120 }),
    slug: fields.string({ required: true, unique: true, max: 120 }),
    excerpt: fields.string({ max: 280 }),
    body: fields.string(),
    published: fields.boolean(),
    publishedAt: fields.datetime(),
  },
});

const config = defineSingleton({
  slug: "config",
  label: "Site config",
  fields: {
    siteName: fields.string({ required: true, max: 80 }),
    description: fields.string({ max: 280 }),
    domain: fields.string({ max: 253 }),
    defaultLocale: fields.string({ max: 35 }),
  },
});

export default defineContent({
  branding: { name: "Voila Playground" },
  collections: [posts],
  singletons: [config],
});
