# @voila/content

The framework entry. Declare collections, singletons, and branding in
`content.config.ts` at the project root; add the vite plugin to
`vite.config.ts`; the entire admin route tree mounts as virtual routes
inside your TanStack Start app.

See [ADR 0002](../../../../docs/decision-records/0002-tanstack-start-integration.md)
for the integration model rationale.

## Basic setup

```ts
// content.config.ts
import { defineCollection, defineContent, defineSingleton, fields } from "@voila/content";

const posts = defineCollection({
  slug: "posts",
  fields: { title: fields.string({ required: true }) },
});

const siteSettings = defineSingleton({
  slug: "site-settings",
  fields: { title: fields.string({ required: true }) },
});

export default defineContent({
  branding: { name: "Acme CMS", accent: "#FF6A00" },
  collections: [posts],
  singletons: [siteSettings],
});
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { voila } from "@voila/content/vite";

export default defineConfig({
  plugins: [
    voila(),          // auto-discovers ./content.config.ts
    tanstackStart(),
  ],
});
```

That's the full setup. No `app/routes/admin/*` files; the plugin
registers the admin route tree as virtual routes.

## Plugin options

| Option   | Type                | Default                 | Notes                                            |
| -------- | ------------------- | ----------------------- | ------------------------------------------------ |
| `config` | `string \| Content` | `"./content.config.ts"` | Custom config path, or an inline `Content` object. |

## M0 scope

This is the M0 surface from [12 — Roadmap](../../docs/requirements/12-roadmap.md):

- `defineContent`, `defineCollection`, `defineSingleton` — typed
  declaration helpers.
- `@voila/content/vite` — `voila()` plugin entry; M0 ships the stub
  that establishes the plugin contract (route registration and the
  `virtual:voila/content` module land alongside the playground app).
- Admin shell route (`/admin`) — blank, branded HTML scaffold with
  `#voila-admin` mount point for the M1 admin SPA, registered by the
  plugin as a virtual route.
- Setup placeholder (`/admin/setup`) — registered by the plugin.
- Healthcheck (`/admin/api/health`) — registered by the plugin.
