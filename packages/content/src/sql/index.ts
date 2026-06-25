// `@voila/content/sql` — the dialect-neutral schema descriptor core. Derives a
// `TableSchema` per collection/singleton from a `NormalizedConfig` (column names,
// per-dialect types, unique indexes). Owned here so both the runtime `Database`
// (row mapping, `@voila/content/server`) and the CLI's DDL/migration renderer
// (`@voila/content-cli`) read column shape from a single source of truth.

export { authTableStatements, authTablesSql } from "./auth-schema";
export {
  deriveSchema,
  MEDIA_TABLE,
  REVISIONS_TABLE,
  SEARCH_TABLE,
  VIEWS_TABLE,
} from "./derive-schema";
export { toColumnName } from "./to-column-name";
export type { ColumnSchema, Dialect, FtsSpec, IndexSchema, TableSchema } from "./types";
