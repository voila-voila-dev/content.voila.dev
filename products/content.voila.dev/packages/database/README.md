# @voila/content-database

Drizzle-based database adapter contract for the Voila CMS, plus the bundled
adapters that implement it.

The root export ships the `DatabaseAdapter` interface; concrete adapters live
at subpaths.

## Adapters

| Subpath                            | Driver         | Use                                     |
| ---------------------------------- | -------------- | --------------------------------------- |
| `@voila/content-database/sqlite`   | `bun:sqlite`   | Local dev, self-hosted Bun              |
| `@voila/content-database/d1`       | `drizzle-orm/d1` | Cloudflare D1 (Workers / Wrangler)    |
| `@voila/content-database/postgres` | `postgres-js`  | Self-hosted Postgres                    |

`postgres` lands in a subsequent milestone — see
[docs/requirements/12-roadmap.md](../../docs/requirements/12-roadmap.md).

## The interface

```ts
import type { DatabaseAdapter } from "@voila/content-database";
```

| Member    | Purpose                                                                            |
| --------- | ---------------------------------------------------------------------------------- |
| `dialect` | `'sqlite' \| 'postgres'` — what Drizzle treats as the SQL flavor. D1 is `sqlite`.  |
| `driver`  | `'better-sqlite3' \| 'bun-sqlite' \| 'd1' \| 'postgres-js'` — the concrete driver. |
| `drizzle` | The Drizzle database instance. Generic; adapters narrow it.                        |
| `close?`  | Release the underlying connection. No-op for connectionless drivers like D1.       |

`dialect` drives schema generation in `@voila/content`; `driver` is what the
`voila migrate` CLI hands to `drizzle-kit` to pick the right migration engine.

## SQLite (local dev)

```ts
import { sqlite } from "@voila/content-database/sqlite";

// In-memory (tests, throwaway dev)
const inMemory = sqlite({ url: ":memory:" });

// libsql-style file URL
const onDisk = sqlite({ url: "file:./data/voila.db" });

// Bare path also accepted
const bare = sqlite({ url: "./data/voila.db" });
```

The adapter wraps Bun's built-in `bun:sqlite` through `drizzle-orm/bun-sqlite`,
so no native module needs to compile. `drizzle-orm` is a (optional) peer
dependency: install whichever version your app pins.

`url` accepts three forms:

- `":memory:"` or `"file::memory:"` → in-memory database
- `"file:<path>"` → libsql-style file URL; the `file:` prefix is stripped
- bare path → passed straight through to `bun:sqlite`

## D1 (Cloudflare Workers)

```ts
import { d1 } from "@voila/content-database/d1";

export default {
  fetch(request: Request, env: { DATABASE: D1Database }) {
    const adapter = d1({ binding: env.DATABASE });
    // hand `adapter` to `@voila/content`
  },
};
```

The adapter wraps `drizzle-orm/d1`, so the underlying binding type comes from
`@cloudflare/workers-types` (or the equivalent shim that ships with `wrangler`).
`dialect` is `"sqlite"` — D1 speaks SQLite SQL — and `close()` is omitted
because D1 is connectionless.

Declare the binding in `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    { "binding": "DATABASE", "database_name": "voila", "database_id": "…" }
  ]
}
```
