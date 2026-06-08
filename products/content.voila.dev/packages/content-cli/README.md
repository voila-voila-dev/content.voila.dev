# @voila/content-cli — WIP / deferred

Holding area for the SQL (DDL generator, migrator, apply) + CLI that were moved
out of `@voila/content` during the pure-TS pivot.

**This package does not build yet.** Its sources are still the original
Effect-based implementation (`@effect/sql`, `@effect/cli`) and their imports
still point at the old in-package paths (`../../config/...`). The next pass
rewrites this package off Effect to pure TypeScript:

- `ddl/` — `deriveSchema` reads `field.meta` (from `@voila/content`) instead of
  the effect/Schema AST; `generateDDL` + `toColumnName` are already pure.
- `migrator/` — journal + generate/apply over `node`/`bun` fs.
- `apply/` — a minimal SQL executor (`bun:sqlite` local, `wrangler` for D1),
  replacing the `@effect/sql` `Database` service (which was removed with the
  server).
- `bin.ts` — pure-TS arg parsing (`node:util` `parseArgs`), replacing `@effect/cli`.
