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
  `vite.config.ts` and it auto-discovers `./content.config.ts`. On
  every dev start the plugin generates the M0 admin route files
  (`src/routes/admin/$.tsx`, `setup.tsx`, `api/health.ts`) inside the
  consumer's tree; consumers gitignore `src/routes/admin/`. Subsequent
  milestones absorb these into proper virtual routes.
- React shell components (`<AdminShell>`, `<SetupPage>`) and head
  builders (`buildAdminHead`, `buildSetupHead`) — internal to the
  package, consumed by the plugin's generated route files via the
  undocumented `@voila/content/internal` subpath. Ready for the M1
  admin SPA to hydrate into `#voila-admin`.

The plugin is the only integration surface; there is no public
factory or handler API to mount the admin from a custom `app/routes/`
file.

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
