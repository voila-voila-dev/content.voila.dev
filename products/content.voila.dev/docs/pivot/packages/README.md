# Per-package design docs

Authoritative reference: [effect-architecture-canon.md](../effect-architecture-canon.md)

These docs describe the FINAL package set after the Effect pivot. Every package name, subpath, and term here derives from §2–§3 of the Canon. If a doc disagrees with the Canon, the Canon wins.

---

## Engine — npm dependencies, Effect only

| Doc | Package | Role |
|-----|---------|------|
| [content-schema.md](./content-schema.md) | `@voila/content-schema` | Field constructors as annotated `effect/Schema`s; `InferDoc`; `defineField`; the `Locale` type. Dependency floor — no other `@voila/*` dep. |
| [content.md](./content.md) | `@voila/content` | The runtime brain: resolver `Service`s, lifecycle hooks, RBAC, localized fields, HTTP API (`/server`), typed client (`/client`), background tasks (`/queue/*`). |
| [content-sql.md](./content-sql.md) | `@voila/content-sql` + `/d1` `/pg` `/sqlite` | `Database` Service, DDL derivation, migrations; dialect subpaths each provide a `SqlClient` Layer. |
| [content-storage.md](./content-storage.md) | `@voila/content-storage` + `/r2` `/s3` | `Storage` Service, presigned URLs, transforms; R2 and S3 Layer subpaths. |
| [content-auth.md](./content-auth.md) | `@voila/content-auth` | `Auth` Service (session, identity, RBAC subject); Better Auth as the default Layer (swappable). |
| [content-mcp.md](./content-mcp.md) | `@voila/content-mcp` | MCP server over `voilaApi`; HTTP and stdio transport Layers; tools auto-derived from `HttpApi` + collection schemas. |

---

## Tooling

| Doc | Package | Role |
|-----|---------|------|
| [content-cli.md](./content-cli.md) | `@voila/content-cli` | The `voila` binary: `migrate`, `seed`, `doctor`, `mcp`, `i18n pull/push/sync/status` (Paraglide/Inlang sync), `add/diff/list` (registry). |
| [content-registry.md](./content-registry.md) | `@voila/content-registry` | `registry.json` manifest + vended source for L6–L11 (route files, admin shell, tables, forms, widgets, theme). |

---

## Cross-product UI

| Doc | Package | Role |
|-----|---------|------|
| [ui.md](./ui.md) | `@voila/ui` | shadcn-on-Base-UI primitives, Tailwind v4 token layer, Phosphor icons. Source-of-truth for all registry UI items. |
| [rich-text-editor.md](./rich-text-editor.md) | `@voila/rich-text-editor` | Plate/Slate editor behavior (`/`) + default node components (`/nodes`). Source-of-truth for the `field/rich-text` registry item. |

---

> **No standalone packages** for `content-core`, `content-http`, `content-client`, `queue`, or `i18n`.
> Those are **subpaths of `@voila/content`** (or, for i18n message sync, commands in `@voila/content-cli`).
