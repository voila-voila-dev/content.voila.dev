// @voila/content-sql — the four system columns every table gets.
//
// Order matters: it's the order columns appear in the rendered DDL, and
// goldens lock that order.

import type { ColumnSchema } from "./types.ts";

/**
 * `id` is a ULID minted by the runtime on insert (see `Database.insert` in
 * M1 — epic 2). We deliberately *don't* set a DB-level default: ULIDs need
 * monotonic time + randomness and we'd rather own that in code (one source
 * of truth, same value the caller sees pre-flight) than commit to a SQL
 * expression that approximates it. Raw INSERTs that bypass the engine must
 * supply their own id.
 *
 * The timestamp columns *do* get DB defaults — `createdAt` / `updatedAt`
 * are server-clock anchors that the engine never overrides on insert; the
 * default keeps things sane if a raw INSERT skips them. `updatedAt` is
 * rewritten on every update by the engine.
 */
export const SYSTEM_COLUMNS: ReadonlyArray<ColumnSchema> = [
  { name: "id", kind: "id", notNull: true, primaryKey: true },
  { name: "created_at", kind: "createdAt", notNull: true },
  { name: "updated_at", kind: "updatedAt", notNull: true },
  { name: "deleted_at", kind: "deletedAt", notNull: false },
];
