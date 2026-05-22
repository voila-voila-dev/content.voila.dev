---
"@voila/content": minor
---

Scaffold `@voila/content` as the framework entry package.

Ships the M0 surface from
[`12 — Roadmap`](../products/content.voila.dev/docs/requirements/12-roadmap.md):

- `defineContent`, `defineCollection`, `defineSingleton` — declarative
  signatures that the rest of the CMS hangs off.
- `content.handle(request: Request): Promise<Response>` — a Web-API handler
  that routes between three sub-handlers based on the configured mount paths.
- Admin shell route (`/admin/*`) — returns a blank, branded HTML scaffold;
  the React admin SPA mounts into `#voila-admin` in M1.
- Healthcheck route (`/admin/api/health`) — returns
  `{ ok: true, name, version, time }` JSON.
- First-run gate (`/admin/setup`) — placeholder HTML page until the auth
  wizard lands in M1.

Re-exports `fields` from `@voila/content-schema` so authors can write
`import { defineContent, fields } from "@voila/content"` in one line.

```ts
import { defineCollection, defineContent, fields } from "@voila/content";

export const content = defineContent({
  branding: { name: "Acme CMS" },
  collections: [
    defineCollection({
      slug: "posts",
      fields: { title: fields.string({ required: true }) },
    }),
  ],
});
```
