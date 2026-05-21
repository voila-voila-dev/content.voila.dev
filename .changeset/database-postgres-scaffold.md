---
"@voila/content-database": minor
---

Scaffold the `postgres` adapter at `@voila/content-database/postgres`.

Ships the public interface (`PostgresAdapterOptions`, `PostgresAdapter`, and
the `postgres({ url })` factory signature) so consumers can type against it.
Calling `postgres()` throws a clear not-implemented error until the M2
implementation lands — at which point the body fills in using
`drizzle-orm/postgres-js` with no signature changes.
