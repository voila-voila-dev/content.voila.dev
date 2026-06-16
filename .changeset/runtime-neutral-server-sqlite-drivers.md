---
"@voila/content": minor
---

Make `@voila/content/server` runtime-neutral and ship a `node:sqlite` driver.

The bun:sqlite driver was re-exported by the `./server` barrel at module
scope, so merely importing `createRestHandler` under Node (e.g. `vite dev`
SSR) threw `ERR_UNSUPPORTED_ESM_URL_SCHEME`. The runtime-specific drivers now
live on their own subpaths:

- `@voila/content/server/bun-sqlite` — `makeBunSqliteDriver` (renamed from
  `makeSqliteDriver`), the existing bun:sqlite driver.
- `@voila/content/server/node-sqlite` — new `makeNodeSqliteDriver` over the
  built-in `node:sqlite` (Node ≥ 22.13), resolved lazily via
  `process.getBuiltinModule` so the module loads on any runtime and only the
  factory demands Node's SQLite.

The barrel keeps the runtime-neutral pieces (`resolveSqliteUrl`,
`SqliteDriver`, `SqliteDriverOpts`) and no longer pulls in `bun:sqlite`. A
scaffolded app can now open the CLI-migrated `local.db` under plain
`vite dev`.
