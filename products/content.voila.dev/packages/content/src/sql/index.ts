// `@voila/content-sql` — M1 surface. Just the DDL pieces today
// (`deriveSchema`, `generateDDL`, `toColumnName`); the `Database` service and
// `MigratorLive` ship with the rest of M1.

export { deriveSchema } from "./ddl/derive-schema";
export { generateDDL } from "./ddl/generate-ddl";
export { toColumnName } from "./ddl/to-column-name";
export type { ColumnSchema, Dialect, IndexSchema, TableSchema } from "./ddl/types";
