# @voila/content-cli

The `voila` command-line toolbelt.

The CLI doesn't reinvent migrations — it drives `drizzle-kit` (for generate)
and Drizzle's bun-sqlite migrator / `wrangler d1 migrations apply` (for
apply). Voila's responsibility is the bridge from `content.config.ts` to
something those tools understand.

## `voila schema generate`

Write the Drizzle bridge file (`drizzle/schema.gen.ts`) from
`content.config.ts`.

```bash
voila schema generate [--dialect sqlite|postgres] [--bridge <path>] [--config <path>]
```

The bridge is a small re-exporter: it imports your config, calls
`schemaToTables(content.collections + content.singletons, { dialect })`,
and exports each table by slug. Both `drizzle-kit` (driven by
`voila migrate generate`) and your own runtime queries consume the same
file.

Run this directly when you want to:

- refresh the bridge without producing a SQL migration
- use the bridge with your own `drizzle.config.ts` (e.g. for
  `drizzle-kit studio` or `drizzle-kit push`)
- import the typed tables in app code:
  ```ts
  import { posts, site } from "./drizzle/schema.gen";
  ```

## `voila migrate generate`

Generate the next migration from `content.config.ts`.

```bash
voila migrate generate [--name <slug>] [--dialect sqlite|postgres] [--out <dir>] [--config <path>]
```

Flow:

1. Calls `voila schema generate` to (re-)write `drizzle/schema.gen.ts`.
2. Spawns `bunx drizzle-kit generate --schema drizzle/schema.gen.ts --out migrations --dialect <…>`.
   Drizzle-kit owns snapshotting (`migrations/meta/_journal.json` +
   per-migration snapshot), diffing (CREATE → ALTER), and filename
   conventions.

Every generated table gets the standard system columns:

| Column      | Type (sqlite)                  | Notes                          |
| ----------- | ------------------------------ | ------------------------------ |
| `id`        | `TEXT PRIMARY KEY`             | ULID (set by `@voila/content`) |
| `createdAt` | `INTEGER NOT NULL DEFAULT now` | `timestamp_ms`                 |
| `updatedAt` | `INTEGER NOT NULL DEFAULT now` | `timestamp_ms`                 |
| `deletedAt` | `INTEGER NULL`                 | soft-delete marker (M2)        |

Singletons additionally get a `CHECK("id" = '<slug>')` so only one row can
exist at the storage layer.

## `voila migrate apply`

Apply pending migrations.

```bash
# Local sqlite file (self-hosted dev)
voila migrate apply --target sqlite --db ./voila.db

# Cloudflare D1 — local Miniflare
voila migrate apply --target d1-local --binding DATABASE

# Cloudflare D1 — production
voila migrate apply --target d1-remote --binding DATABASE
```

- `--target sqlite` opens the database via `bun:sqlite` and calls Drizzle's
  `migrate()` from `drizzle-orm/bun-sqlite/migrator`. Drizzle tracks applied
  migrations in `__drizzle_migrations`.
- `--target d1-local` / `--target d1-remote` shells out to
  `wrangler d1 migrations apply <binding> [--local|--remote]`. Wrangler owns
  the `d1_migrations` tracking table.

`--out` is only honored for `--target sqlite`. For D1, set `migrations_dir`
in `wrangler.jsonc` instead.

## Programmatic API

```ts
import { migrateApply, migrateGenerate, schemaGenerate } from "@voila/content-cli";

await schemaGenerate({ cwd });                   // bridge only
await migrateGenerate({ cwd, name: "add-tags" }); // bridge + drizzle-kit
await migrateApply({ cwd, target: "sqlite", db: "./voila.db" });
```

## Generated files

- `drizzle/schema.gen.ts` — bridge file consumed by drizzle-kit. Generated;
  gitignore it.
- `migrations/NNNN_*.sql` — DDL emitted by drizzle-kit. Commit these.
- `migrations/meta/_journal.json` + `migrations/meta/NNNN_snapshot.json` —
  drizzle-kit's snapshot. Commit these; future `migrate generate` runs need
  them to compute the diff.
