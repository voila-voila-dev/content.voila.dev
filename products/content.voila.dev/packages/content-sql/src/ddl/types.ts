// @voila/content-sql — DDL types.
//
// `deriveSchema` emits these dialect-neutral descriptors from a list of
// collection configs; `generateDDL` renders them into a `CREATE TABLE` /
// `CREATE INDEX` script per dialect.

import type { Schema } from "effect";

/** Supported SQL dialects for DDL rendering. */
export type Dialect = "sqlite" | "postgres";

/**
 * Discriminator of every column kind we know how to render. System columns
 * (`id`, `createdAt`, `updatedAt`, `deletedAt`) get dedicated kinds so the
 * renderer can attach the right defaults without keying off column names.
 */
export type ColumnKind =
  // System
  | "id"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  // User
  | "string"
  | "number" // floating-point — REAL / real
  | "integer" // INTEGER / integer
  | "boolean"
  | "date" // calendar date (no time)
  | "datetime" // instant (ms since epoch / timestamptz)
  | "json"
  | "select" // stored as TEXT in both dialects
  | "slug"; // stored as TEXT in both dialects

/** A single column in a `TableSchema`. */
export interface ColumnSchema {
  /** Snake-cased column name. */
  readonly name: string;
  /** Drives type + default rendering per dialect. */
  readonly kind: ColumnKind;
  readonly notNull: boolean;
  readonly unique?: boolean;
  readonly primaryKey?: boolean;
}

/** A secondary index emitted as a separate `CREATE INDEX` statement. */
export interface IndexSchema {
  readonly name: string;
  readonly column: string;
}

/**
 * A table-level CHECK constraint. The `expr` is rendered verbatim — only
 * `deriveSchema` produces these and it pre-validates every literal it puts
 * in `expr` so it stays SQL-injection-safe.
 */
export interface CheckSchema {
  readonly name: string;
  readonly expr: string;
}

/** Dialect-neutral table descriptor. */
export interface TableSchema {
  readonly name: string;
  readonly columns: ReadonlyArray<ColumnSchema>;
  readonly indexes: ReadonlyArray<IndexSchema>;
  readonly checks: ReadonlyArray<CheckSchema>;
}

/**
 * Structural shape accepted by `deriveSchema`. Matches `Collection` /
 * `Singleton` from `@voila/content` without taking a runtime dependency on
 * that package (would be circular: content → content-sql).
 */
export interface CollectionConfig {
  readonly kind: "collection" | "singleton";
  readonly slug: string;
  readonly fields: Readonly<Record<string, Schema.Schema.Any>>;
}
