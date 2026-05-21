---
"@voila/content-database": minor
---

Initial release of `@voila/content-database`.

- `DatabaseAdapter<TDrizzle>` interface: every concrete adapter exposes a Drizzle
  instance plus `dialect` (`sqlite` | `postgres`) and `driver`
  (`better-sqlite3` | `bun-sqlite` | `d1` | `postgres-js`) tags.
- `AnyDatabaseAdapter` variance escape hatch for code that operates on any adapter.

Concrete SQLite, D1, and Postgres adapters land in subsequent changesets.
