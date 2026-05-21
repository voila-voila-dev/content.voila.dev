# @voila/content-database

Drizzle-based database adapter contract for the Voila CMS.

The package itself ships only the `DatabaseAdapter` interface that every concrete
adapter implements. Concrete adapters (SQLite, Cloudflare D1, Postgres) land
under `@voila/content-database/<driver>` in subsequent milestones — see
[docs/requirements/12-roadmap.md](../../docs/requirements/12-roadmap.md).

```ts
import type { DatabaseAdapter } from "@voila/content-database";

// Each concrete adapter narrows `TDrizzle` to its own Drizzle instance type.
const database: DatabaseAdapter = {
  dialect: "sqlite",
  driver: "d1",
  drizzle: /* drizzle(d1Binding) */ {},
};
```

## Shape

| Member    | Purpose                                                                            |
| --------- | ---------------------------------------------------------------------------------- |
| `dialect` | `'sqlite' \| 'postgres'` — what Drizzle treats as the SQL flavor. D1 is `sqlite`.  |
| `driver`  | `'better-sqlite3' \| 'bun-sqlite' \| 'd1' \| 'postgres-js'` — the concrete driver. |
| `drizzle` | The Drizzle database instance. Generic; adapters narrow it.                        |
| `close?`  | Release the underlying connection. No-op for connectionless drivers like D1.       |

`dialect` drives schema generation in `@voila/content`; `driver` is what the
`voila migrate` CLI hands to `drizzle-kit` to pick the right migration engine.
