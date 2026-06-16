# @voila/content-cli

The `voila` CLI plus the SQL machinery (DDL generator + migrator) that turn a
`@voila/content` `defineConfig` into a real database schema. Pure TypeScript,
zero runtime dependencies beyond `@voila/content` — built on `bun:sqlite`,
`node:fs`, `node:util` `parseArgs`, and (for D1) `wrangler`.

## CLI

```sh
# Generate the next NNNN_name.sql migration from your content config
voila migrate generate --config content.config.ts --name init --dialect sqlite

# Apply pending migrations
voila migrate apply --target sqlite   --db file:./local.db   # --db defaults to file:./local.db
voila migrate apply --target d1-local --db my-database       # delegates to wrangler
```

- `generate` — derives one table per collection/singleton (`deriveSchema` reads
  `field.meta`), renders `sqlite` or `postgres` DDL, writes `NNNN_<name>.sql`.
- `apply` — runs pending files and records them in the `voila_migrations`
  journal (idempotent); D1 targets shell out to `wrangler d1 migrations apply`.

## Programmatic surface

`@voila/content-cli/sql` exports `deriveSchema`, `generateDDL`, `toColumnName`,
`generateMigration`, `applySqlite`, `applyD1`, and the loader helpers.

## Deferred to Phase 2

The runtime `Database` service (list/get/create/update CRUD) and the
`SqliteLive` / `D1Live` client layers ship with the Phase 2 server/client, where
their driver seam is co-designed with the consumer. Auth-table provisioning
(`--auth`) returns when auth is rebuilt in Phase 2.
