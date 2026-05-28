// @voila/content-sql/ddl — schema → DDL pipeline.
//
// Public entry consumed via `@voila/content-sql` root (re-exported there).
// Split out here so the rendering logic stays self-contained and the root
// `index.ts` keeps its role as the Service surface.

export { deriveSchema } from "./derive-schema.ts";
export { generateDDL } from "./generate-ddl.ts";
export { SYSTEM_COLUMNS } from "./system-columns.ts";
export type {
  CheckSchema,
  CollectionConfig,
  ColumnKind,
  ColumnSchema,
  Dialect,
  IndexSchema,
  TableSchema,
} from "./types.ts";
export {
  assertValidFieldName,
  assertValidSlug,
  IDENT_RE,
  SYSTEM_COLUMN_NAMES,
} from "./validate.ts";
