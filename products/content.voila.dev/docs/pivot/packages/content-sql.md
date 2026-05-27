# @voila/content-sql

> Database Service (`Database`) over `@effect/sql`: CRUD primitives, schema→DDL derivation, and migration orchestration. **World:** Engine. **Layer:** L3. **Status:** M0 scaffold → M1 CRUD complete → M2 migrations.

## Responsibility

**Owns:**
- The `Database` `Service` — the single query interface the resolver layer (`@voila/content`) calls.
- Schema→DDL derivation: reads `VoilaField` annotations from `@voila/content-schema` schemas to generate `CREATE TABLE` SQL for each collection/singleton, including system columns (`id`, `created_at`, `updated_at`, `deleted_at`) and singleton `CHECK` constraints.
- camelCase→snake_case column name mapping (`toColumnName`).
- Migration generation (`voila migrate generate`) and application (`voila migrate apply`) via `@effect/sql/Migrator`.
- Query compilation (list with cursor pagination, get by id, insert, update, soft-delete, restore).

**Does not own:**
- The `SqlClient` implementation — that is the seam; dialect packages provide it as a `Layer`.
- Auth, RBAC, lifecycle hooks — `@voila/content`.
- HTTP handlers — `@voila/content/server`.

## Public API

| Export | Kind | Description |
|--------|------|-------------|
| `Database` | `Context.Tag<Database>` | The service tag resolvers depend on |
| `DatabaseLive` | `Layer<Database, never, SqlClient>` | Default impl; requires a `SqlClient` Layer from a dialect package |
| `deriveSchema` | `(collections: readonly CollectionConfig[]) => TableSchema[]` | Reads field annotations, emits dialect-neutral table descriptors |
| `generateDDL` | `(tables: TableSchema[], dialect: Dialect) => string` | Renders `CREATE TABLE` SQL from table descriptors |
| `MigratorLive` | `Layer<never, MigrationError, Database \| SqlClient>` | Wires `@effect/sql/Migrator`; consumed by `voila migrate apply` |
| `toColumnName` | `(camelCase: string) => string` | `"createdAt"` → `"created_at"` |

### `Database` service interface (conceptual)

```ts
interface Database {
  // queries
  readonly list: (collection: string, opts: ListOpts) => Effect<ListResult, DatabaseError>
  readonly get: (collection: string, id: string) => Effect<Row | null, DatabaseError>
  // writes
  readonly insert: (collection: string, row: Row) => Effect<Row, DatabaseError>
  readonly update: (collection: string, id: string, patch: Partial<Row>) => Effect<Row, DatabaseError>
  readonly softDelete: (collection: string, id: string) => Effect<void, DatabaseError>
  readonly restore: (collection: string, id: string) => Effect<void, DatabaseError>
}
```

## Effect surface

| Primitive | Use |
|-----------|-----|
| `@effect/sql` `SqlClient` | Seam — all queries go through this Tag |
| `@effect/sql/Migrator` | Migration orchestration (up/down, journal) |
| `Context.Tag` | `Database` service identity |
| `Layer` | `DatabaseLive`, `MigratorLive` |
| `Effect.gen` | Query implementations |
| `Schema` (effect/Schema) | Row codec; reads `VoilaField` annotations for DDL |
| `Data.TaggedError` | `DatabaseError`, `MigrationError` typed errors |

## Dependencies

```json
{
  "dependencies": {
    "effect":        "^3.x",
    "@effect/sql":   "^0.x",
    "@voila/content-schema": "workspace:*"
  },
  "peerDependencies": {
    "@effect/sql-d1":          "optional",
    "@effect/sql-pg":          "optional",
    "@effect/sql-sqlite-bun":  "optional"
  }
}
```

Dialect packages are **optional peers** — `@voila/content-sql` itself never imports them, keeping the bundle dialect-free.

## Usage

### Consume `Database` in a resolver

```ts
import { Database } from "@voila/content-sql"
import { Effect } from "effect"

const listPosts = Effect.gen(function* () {
  const db = yield* Database
  return yield* db.list("posts", { limit: 20, cursor: undefined })
})
```

### Wire a dialect and run

```ts
import { Database, DatabaseLive } from "@voila/content-sql"
import { D1Live } from "@voila/content-sql/d1"
import { Layer, ManagedRuntime } from "effect"

// D1Live provides SqlClient; DatabaseLive consumes it
const AppLayer = DatabaseLive.pipe(Layer.provide(D1Live({ binding: env.DATABASE })))

const runtime = ManagedRuntime.make(AppLayer)
const result  = await runtime.runPromise(listPosts)
```

### Schema→DDL derivation

```ts
import { deriveSchema, generateDDL } from "@voila/content-sql"
import { posts } from "~/content.config"

const tables = deriveSchema([posts])
const sql    = generateDDL(tables, "sqlite")
// → CREATE TABLE "posts" ("id" TEXT PRIMARY KEY, "created_at" INTEGER NOT NULL, ...)
```

### Singleton tables

A singleton collection emits an additional `CHECK` constraint so only one row can exist:

```ddl
-- Generated for defineSingleton({ slug: "site", ... })
CREATE TABLE "site" (
  "id"         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || ...)),
  "created_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "updated_at" INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  "deleted_at" INTEGER,
  "title"      TEXT NOT NULL,
  CHECK (id = 'site')
)
```

## Extension points (A′)

Swap the dialect by providing a different `SqlClient` Layer — nothing in `@voila/content-sql` changes:

```ts
// Turso (libSQL) — a community @effect/sql-libsql would drop in here
import { TursoLive } from "@effect/sql-libsql"  // hypothetical
const AppLayer = DatabaseLive.pipe(Layer.provide(TursoLive({ url, authToken })))
```

Wrap `Database` to add audit logging without forking:

```ts
import { Database, DatabaseLive } from "@voila/content-sql"
import { Effect, Layer } from "effect"

const AuditedDatabase = Layer.effect(
  Database,
  Effect.gen(function* () {
    const base = yield* Database
    return {
      ...base,
      insert: (col, row) =>
        base.insert(col, row).pipe(Effect.tap(() => audit("insert", col))),
    }
  }),
).pipe(Layer.provide(DatabaseLive))
```

## Replaces

`@voila/content-database` (Drizzle-based). Specifically:

| Old | New |
|-----|-----|
| `drizzle-orm` + `drizzle-kit` | `@effect/sql` + `@effect/sql/Migrator` |
| `schemaToTables()` → Drizzle table objects | `deriveSchema()` → dialect-neutral `TableSchema[]` |
| `buildSqliteTable` / `buildPostgresTable` | DDL rendered by `generateDDL(tables, dialect)` |
| `DatabaseAdapter<TDrizzle>` interface | `SqlClient` Tag (provided by dialect packages) |
| `d1()` / `postgres()` / `sqlite()` adapter constructors | `D1Live` / `PgLive` / `SqliteLive` Layers |
| Golden-file tests (`schema.sqlite.sql`, `schema.postgres.sql`) | Ported as `deriveSchema` + `generateDDL` unit tests |

Drizzle is fully removed — no `drizzle-orm`, no `drizzle-kit`, no `drizzle/` schema files.

## Testing

- **Unit — DDL derivation:** `deriveSchema` + `generateDDL` for every field kind against both dialects; golden-file snapshots ported from `@voila/content-database` (`schema.sqlite.sql`, `schema.postgres.sql`). Runs without a real DB.
- **Unit — singleton check constraint:** assert the `CHECK (id = '<slug>')` clause appears in the DDL output.
- **Integration — `Database` service:** spin `SqliteLive` (in-memory) + `DatabaseLive` as a test `Layer`; exercise list/get/insert/update/softDelete/restore round-trips.
- **Integration — `MigratorLive`:** apply migrations against an in-memory SQLite; assert journal table updated and schema matches golden DDL.
- All tests via `bun test` + `@effect/vitest`-style Effect test utilities; no external DB process required.

---

## Dialects

Each dialect is a separate subpath that provides a `SqlClient` `Layer`. Install only the one(s) you use; drivers are **optional peer dependencies** of this package and are never imported from the root import.

### `@voila/content-sql/d1` — Cloudflare D1

`D1Live`: a `Layer<SqlClient>` for Workers deployments. Wraps `@effect/sql-d1` around the raw `D1Database` binding.

```ts
import { D1Live } from "@voila/content-sql/d1"

export default defineContent({
  collections: [posts],
  database: D1Live({ binding: env.DATABASE }),  // env.DATABASE is the D1Database Workers binding
})
```

| Export | Kind | Description |
|--------|------|-------------|
| `D1Live` | `(opts: D1LiveOpts) => Layer<SqlClient>` | Constructs `SqlClient` from a D1 binding |
| `D1LiveOpts` | `interface` | `{ binding: D1Database }` |

**Peer deps:** `@effect/sql-d1`, `@cloudflare/workers-types`.

If the binding is absent (misconfigured `wrangler.jsonc`) `D1Live` throws at runtime. Replace with `PgLive` or `SqliteLive` for non-Workers deployments — `DatabaseLive` is unchanged.

**Testing:** thin adapter glue — covered by the `@voila/content-sql` integration suite running `DatabaseLive` against `SqliteLive` (in-memory). D1-specific wiring is exercised by a Miniflare-backed integration test in the playground canary.

---

### `@voila/content-sql/pg` — Postgres (Neon, Supabase, traditional PG)

`PgLive`: a `Layer<SqlClient>` that wraps `@effect/sql-pg` around `postgres-js`. Connection lifecycle (open on first query, close on runtime shutdown) is managed by `Layer.scoped` — no explicit `close()` call required.

```ts
import { PgLive } from "@voila/content-sql/pg"

export default defineContent({
  collections: [posts],
  database: PgLive({ url: process.env.DATABASE_URL! }),
})
```

| Export | Kind | Description |
|--------|------|-------------|
| `PgLive` | `(opts: PgLiveOpts) => Layer<SqlClient>` | Constructs `SqlClient` from a connection URL |
| `PgLiveOpts` | `interface` | `{ url: string; ssl?: boolean }` |

**Peer deps:** `@effect/sql-pg`, `postgres` (`^3.x`).

To add PgBouncer pooling, configure the URL directly (`?pgbouncer=true` is honored by postgres-js) or wrap `PgLive`.

**Testing:** integration-tested via `bun test` against a local Postgres process (or Neon branch) in CI. Core `@voila/content-sql` unit tests use `SqliteLive` (in-memory) — no Postgres process required.

---

### `@voila/content-sql/sqlite` — SQLite via `bun:sqlite`

`SqliteLive`: a `Layer<SqlClient>` for local development and as the universal test double. Opens a Bun SQLite database from a URL or bare file path; closes it on `Layer.scoped` teardown.

```ts
import { SqliteLive } from "@voila/content-sql/sqlite"

// Local dev
export default defineContent({
  collections: [posts],
  database: SqliteLive({ url: "file:./local.db" }),
})

// In-memory test double
import { Database, DatabaseLive } from "@voila/content-sql"
import { Layer } from "effect"

const TestLayer = DatabaseLive.pipe(Layer.provide(SqliteLive({ url: ":memory:" })))
```

| Export | Kind | Description |
|--------|------|-------------|
| `SqliteLive` | `(opts: SqliteLiveOpts) => Layer<SqlClient>` | Constructs `SqlClient` from a file URL |
| `SqliteLiveOpts` | `interface` | `{ url: string }` — libsql-style URL or bare file path |
| `resolveSqliteUrl` | `(url: string) => string` | Strips `file:` prefix; maps `:memory:` / `file::memory:` to `:memory:` |

**Peer deps:** none — `bun:sqlite` is built into Bun; `@effect/sql-sqlite-bun` is a direct dep.

`SqliteLive` is the canonical test double for the entire `@voila/content-sql` integration suite.

---

Continue → [content.md](./content.md) · [content-storage.md](./content-storage.md)
