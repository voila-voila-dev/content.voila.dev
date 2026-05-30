// Playground content config — the **client-safe** surface: branding + collections
// + auth metadata, but NO database/auth *layers* (those pull `bun:sqlite` / D1 /
// better-auth, which must not reach the browser bundle). The server composes the
// full `Content` (database + Better Auth) from these inputs in `server/voila.ts`.
//
// The admin UI and the typed atoms import the default `config` (a
// `NormalizedConfig`) for branding, collection metadata, and end-to-end typing.
import { defineCollection, defineConfig, fields } from "@voila/content";

export const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  fields: {
    title: fields.string({ min: 1, required: true }),
    published: fields.boolean({ defaultValue: false }),
  },
});

export const collections = { posts };
export const branding = { name: "Playground" } as const;

/** Brand interpolated into the magic-link email; the server passes it to `auth`. */
export const authBrand = "Playground";

/** Normalized, client-safe config — branding + collections + typing. */
const config = defineConfig({ branding, collections });
export default config;
