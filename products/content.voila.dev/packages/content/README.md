# @voila/content

The framework entry. Compose collections, singletons, and branding into a
single `content` object, then mount its Web-API handler on the catch-all
admin route.

```ts
// content.config.ts
import { defineCollection, defineContent, defineSingleton, fields } from "@voila/content";

const posts = defineCollection({
  slug: "posts",
  label: "Posts",
  fields: {
    title: fields.string({ required: true, max: 200 }),
    body: fields.string(),
  },
});

const siteSettings = defineSingleton({
  slug: "site-settings",
  label: "Site Settings",
  fields: {
    title: fields.string({ required: true }),
  },
});

export const content = defineContent({
  branding: { name: "Acme CMS", favicon: "/favicon.ico", accent: "#FF6A00" },
  collections: [posts],
  singletons: [siteSettings],
});
```

```ts
// app/routes/admin/$.ts
import { createServerFileRoute } from "@tanstack/react-start/server";
import { content } from "~/content.config";

export const ServerRoute = createServerFileRoute("/admin/$").methods({
  GET: ({ request }) => content.handle(request),
  POST: ({ request }) => content.handle(request),
  PUT: ({ request }) => content.handle(request),
  PATCH: ({ request }) => content.handle(request),
  DELETE: ({ request }) => content.handle(request),
});
```

## Mount points

Defaults shown:

| Path           | Purpose                          | Override          |
| -------------- | -------------------------------- | ----------------- |
| `/admin`       | Admin SPA shell                  | `mount.admin`     |
| `/admin/api`   | REST/RPC endpoints               | `mount.api`       |
| `/admin/mcp`   | MCP server                       | `mount.mcp`       |
| `/admin/setup` | First-run setup wizard           | `${mount.admin}/setup` |
| `/admin/api/health` | Liveness/readiness probe    | `${mount.api}/health`  |

`content.handle(request)` is a plain `Request → Promise<Response>` function;
it has no Node, Bun, or Cloudflare-specific assumptions and runs anywhere the
Web Fetch API runs.

## M0 scope

This is the M0 scaffold — see
[12 — Roadmap](../../docs/requirements/12-roadmap.md). At this stage the
handler resolves to:

- a blank, branded admin HTML shell for `/admin/*`
- a JSON healthcheck at `/admin/api/health`
- a placeholder setup page at `/admin/setup`
- a 404 envelope for unknown `/admin/api/*` routes
- a plain-text 404 for anything outside both mounts

Read endpoints, the typed client, and the admin SPA itself land in M1.
