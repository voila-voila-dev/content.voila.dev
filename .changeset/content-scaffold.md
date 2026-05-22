---
"@voila/content": minor
---

Scaffold `@voila/content` as the framework entry package, integrating as
a TanStack Start vite plugin per
[ADR 0002](../docs/decision-records/0002-tanstack-start-integration.md).

The M0 surface:

- `defineContent`, `defineCollection`, `defineSingleton` — declarative
  signatures the rest of the CMS hangs off. `defineContent` is the
  default export of the conventional `content.config.ts` at the project
  root.
- `@voila/content/vite` subpath — the `voila()` plugin. Add it to
  `vite.config.ts` and it auto-discovers `./content.config.ts`. M0
  ships the plugin contract stub; route registration and the
  `virtual:voila/content` module land alongside the playground.
- `@voila/content/admin` subpath — `adminRouteOptions(content)` and
  `setupRouteOptions(content)` factories that return objects
  structurally compatible with TanStack Router's `createFileRoute(…)`.
- `@voila/content/server-routes` subpath — `healthGET` handler,
  structurally compatible with TanStack Start's
  `createServerFileRoute(…).methods({ GET })`.
- React shell rendered via `renderToStaticMarkup` of `<AdminShell>` and
  `<SetupPage>` components — ready for the M1 admin SPA to hydrate
  into `#voila-admin`.

Re-exports `fields` from `@voila/content-schema` so authors can write
`import { defineContent, fields } from "@voila/content"` in one line.

```ts
// content.config.ts
import { defineCollection, defineContent, fields } from "@voila/content";

export default defineContent({
  branding: { name: "Acme CMS" },
  collections: [
    defineCollection({
      slug: "posts",
      fields: { title: fields.string({ required: true }) },
    }),
  ],
});
```

```ts
// vite.config.ts
import { voila } from "@voila/content/vite";

export default defineConfig({
  plugins: [voila(), tanstackStart()],
});
```
