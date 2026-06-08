// `@voila/content-sql` — M1 surface. DDL derivation (`deriveSchema`,
// `generateDDL`, `toColumnName`), the local `SqliteLive` client Layer, and the
// migration generate/apply machinery. The full `Database` service ships with
// the rest of M1.

export { type D1Binding, D1Live, type D1LiveOpts } from "./client/d1";
export { resolveSqliteUrl, SqliteLive, type SqliteLiveOpts } from "./client/sqlite";
export {
  type CursorPosition,
  Database,
  DatabaseError,
  type DatabaseService,
  type Document,
  decodeCursor,
  encodeCursor,
  type FieldValue,
  type ListOpts,
  type ListResult,
  makeDatabaseLayer,
  type OrderDirection,
} from "./database";
export { deriveSchema } from "./ddl/derive-schema";
export { generateDDL } from "./ddl/generate-ddl";
export { toColumnName } from "./ddl/to-column-name";
export type { ColumnSchema, Dialect, IndexSchema, TableSchema } from "./ddl/types";
export type {
  ApplyD1Opts,
  ApplySqliteOpts,
  ApplyTarget,
  GenerateMigrationOpts,
  ParsedMigration,
} from "./migrator";
export {
  applyD1,
  applySqlite,
  formatMigrationId,
  fromSqlFiles,
  generateMigration,
  nextMigrationId,
  parseMigrationFile,
  splitStatements,
} from "./migrator";
