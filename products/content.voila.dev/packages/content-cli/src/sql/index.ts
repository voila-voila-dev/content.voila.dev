// `@voila/content-cli` SQL surface — Phase 1. DDL rendering (`generateDDL`) and
// the migration generate/apply machinery.
//
// The dialect-neutral schema descriptor core (`deriveSchema`, `toColumnName`,
// `TableSchema`, …) moved to `@voila/content/sql` so the runtime `Database`
// (`@voila/content/server`) and this CLI share one column-mapping source. It's
// re-exported here to keep the historical `@voila/content-cli/sql` surface stable.

export {
  type ColumnSchema,
  type Dialect,
  deriveSchema,
  type IndexSchema,
  type TableSchema,
  toColumnName,
} from "@voila/content/sql";
export { generateDDL } from "./ddl/generate-ddl";
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
