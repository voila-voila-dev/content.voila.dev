// `@voila/content/server` — the runtime data layer. Phase 2 ships the `Database`
// service (CRUD + keyset pagination over a `SqlDriver`) and the SQLite/D1 driver
// adapters. The REST endpoints, typed client, and auth build on top of this seam.

export * from "./database";
