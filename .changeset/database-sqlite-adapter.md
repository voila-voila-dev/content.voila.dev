---
"@voila/content-database": minor
---

Add the `sqlite` adapter at `@voila/content-database/sqlite`.

Wraps Bun's built-in `bun:sqlite` through `drizzle-orm/bun-sqlite`, so no
native module needs to compile. Accepts a libsql-style `url`:

- `":memory:"` / `"file::memory:"` — in-memory database
- `"file:<path>"` — file URL; the `file:` prefix is stripped
- bare path — passed straight through to `bun:sqlite`

`drizzle-orm` is declared as an optional peer dependency so consumers control
the version.
