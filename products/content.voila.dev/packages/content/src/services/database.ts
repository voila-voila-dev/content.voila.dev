// @voila/content/services/database — re-export of the canonical Database Tag.
//
// The single source of truth for `Database` + `DatabaseLive` lives in
// `@voila/content-sql`. The umbrella re-exports it (one identity, one TS type)
// so consumers wiring `defineContent` import everything from `@voila/content`
// without ever having to think about which package owns the Tag.

// Backward-compat alias for early M0 callers that referenced `DatabaseShape`.
export type { DatabaseService as DatabaseShape } from "@voila/content-sql";
export {
  Database,
  DatabaseLive,
  type DatabaseService,
  type ListOpts,
  type ListResult,
  type Row,
} from "@voila/content-sql";
