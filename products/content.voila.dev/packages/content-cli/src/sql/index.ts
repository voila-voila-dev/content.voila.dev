// `@voila/content-cli` SQL surface — Phase 1. DDL derivation (`deriveSchema`,
// `generateDDL`, `toColumnName`) and the migration generate/apply machinery.
//
// The runtime `Database` service (list/get/create/update CRUD) and the
// `SqliteLive`/`D1Live` client layers ship with the Phase 2 server/client.

export { deriveSchema } from "./ddl/derive-schema";
export { generateDDL } from "./ddl/generate-ddl";
export { toColumnName } from "./ddl/to-column-name";
export type { ColumnSchema, Dialect, IndexSchema, TableSchema } from "./ddl/types";
export type {
  ApplyD1Opts,
  ApplySqliteOpts,
  ApplyTarget,
  GenerateMigrationOpts,
  LoadedMigration,
  ParsedMigration,
} from "./migrator";
export {
  applyD1,
  applySqlite,
  formatMigrationId,
  generateMigration,
  loadMigrations,
  nextMigrationId,
  parseMigrationFile,
  splitStatements,
} from "./migrator";
