// `DatabaseLive` — the default `Database` implementation over the `@effect/sql`
// `SqlClient` seam. Reads the dialect-neutral table descriptors from
// `deriveSchema(config)` to map snake_case rows back to camelCase documents
// (parsing JSON columns) and to validate `orderBy` against real columns.

import { SqlClient } from "@effect/sql/SqlClient";
import type { SqlError } from "@effect/sql/SqlError";
import type { Fragment } from "@effect/sql/Statement";
import { Clock, Effect, Layer, Option } from "effect";
import type { NormalizedConfig } from "../../config/config";
import { deriveSchema } from "../ddl/derive-schema";
import type { ColumnSchema, TableSchema } from "../ddl/types";
import { type CursorPosition, decodeCursor, encodeCursor } from "./cursor";
import {
  Database,
  DatabaseError,
  type Document,
  type FieldValue,
  type ListOpts,
  type ListResult,
} from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface ColumnInfo {
  readonly name: string;
  readonly fieldName: string;
  readonly isJson: boolean;
  readonly isBoolean: boolean;
  readonly isTimestamp: boolean;
}

interface TableInfo {
  readonly name: string;
  /** Indexed by column name (snake_case) for row→document mapping. */
  readonly byColumn: ReadonlyMap<string, ColumnInfo>;
  /** Indexed by field name (camelCase) for `orderBy` resolution. */
  readonly byField: ReadonlyMap<string, ColumnInfo>;
}

// JSON columns render to Postgres `JSONB` regardless of dialect, so the postgres
// type is the dialect-neutral marker for "parse this on read".
const isJsonColumn = (col: ColumnSchema): boolean => col.type.postgres === "JSONB";

// SQLite has no boolean type — booleans live in `INTEGER` columns as 0/1, which
// the driver hands back as numbers. The Postgres `BOOLEAN` type is the
// dialect-neutral marker for "coerce 0/1 → boolean on read".
const isBooleanColumn = (col: ColumnSchema): boolean => col.type.postgres === "BOOLEAN";

// `datetime` (and the system timestamps) store epoch-ms canonically. SQLite
// returns the raw `INTEGER` (already a number); Postgres `TIMESTAMPTZ` comes
// back as a `Date`, so it's normalized to epoch ms on read. (Calendar `date` is
// Postgres `DATE`, not `TIMESTAMPTZ`, so it stays an ISO string.)
const isTimestampColumn = (col: ColumnSchema): boolean => col.type.postgres === "TIMESTAMPTZ";

// Normalize a raw driver value into the canonical encoded form the field schema
// decodes, smoothing over SQLite/Postgres representation differences. Every
// branch is type-guarded so a value already in canonical form passes through.
const normalize = (info: ColumnInfo | undefined, value: unknown): unknown => {
  if (info?.isJson) return typeof value === "string" ? JSON.parse(value) : value;
  if (info?.isBoolean) return typeof value === "number" ? value !== 0 : value;
  if (info?.isTimestamp) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") return Date.parse(value);
    return value;
  }
  // Postgres returns 64-bit integers (e.g. `BIGINT` duration) as `bigint`.
  if (typeof value === "bigint") return Number(value);
  return value;
};

// The canonical, JSON-serializable form of a keyset boundary value. Converts the
// scalar cases that can be ordered on (timestamps as epoch ms, bigints) without
// parsing JSON or coercing booleans, so the encoded value compares correctly
// against the stored column on the next page.
const toCursorValue = (value: unknown): CursorPosition["value"] => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
};

export const indexTable = (table: TableSchema): TableInfo => {
  const byColumn = new Map<string, ColumnInfo>();
  const byField = new Map<string, ColumnInfo>();
  for (const col of table.columns) {
    const info: ColumnInfo = {
      name: col.name,
      fieldName: col.fieldName,
      isJson: isJsonColumn(col),
      isBoolean: isBooleanColumn(col),
      isTimestamp: isTimestampColumn(col),
    };
    byColumn.set(col.name, info);
    byField.set(col.fieldName, info);
  }
  return { name: table.name, byColumn, byField };
};

export const mapRow = (table: TableInfo, row: Record<string, unknown>): Document => {
  const doc: Document = {};
  for (const [column, value] of Object.entries(row)) {
    const info = table.byColumn.get(column);
    doc[info?.fieldName ?? column] = normalize(info, value);
  }
  return doc;
};

// Inverse of `normalize`: take a canonical (decoded-then-re-encoded) field value and
// render the storage form each driver expects. SQLite/D1 store booleans as 0/1 and
// JSON as text; timestamps are epoch-ms integers. (Postgres takes native booleans —
// handled when the live pg `Layer` lands; only SQLite/D1 run today.)
const encodeValue = (info: ColumnInfo | undefined, value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (info?.isJson) return typeof value === "string" ? value : JSON.stringify(value);
  if (info?.isBoolean) return value ? 1 : 0;
  if (info?.isTimestamp) return value instanceof Date ? value.getTime() : value;
  return value;
};

// Canonical camelCase document → snake_case storage columns (the inverse of `mapRow`).
// Unknown fields pass through under their own name so a misconfigured write surfaces
// as a SQL error rather than being silently dropped.
export const encodeRow = (table: TableInfo, doc: Document): Record<string, unknown> => {
  const row: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(doc)) {
    const info = table.byField.get(field);
    row[info?.name ?? field] = encodeValue(info, value);
  }
  return row;
};

// The driver's real message lives on the nested `cause` (the `SqlError` itself just
// says "Failed to execute statement"), so flatten the whole chain before matching.
const errorText = (error: SqlError): string => {
  const parts: Array<string> = [error.message];
  let cause: unknown = (error as { readonly cause?: unknown }).cause;
  for (let depth = 0; cause != null && depth < 5; depth++) {
    if (typeof cause === "object" && "message" in cause) {
      parts.push(String((cause as { readonly message: unknown }).message));
    }
    cause = (cause as { readonly cause?: unknown }).cause;
  }
  return parts.join(" | ");
};

// SQLite/D1: `UNIQUE constraint failed: <table>.<column>`. Postgres: SQLSTATE 23505.
const UNIQUE_SQLITE = /UNIQUE constraint failed:\s*\w+\.(\w+)/i;

// Classify a driver error: a unique violation (with the offending field, when the
// driver names the column) or `null` for any other failure.
const detectConflict = (
  table: TableInfo,
  message: string,
): { readonly field: string | null } | null => {
  const matched = UNIQUE_SQLITE.exec(message);
  if (matched?.[1] !== undefined) {
    return { field: table.byColumn.get(matched[1])?.fieldName ?? matched[1] };
  }
  if (/duplicate key value|sqlite_constraint_unique|\b23505\b/i.test(message)) {
    return { field: null };
  }
  return null;
};

export const makeDatabaseLayer = (
  config: NormalizedConfig,
): Layer.Layer<Database, never, SqlClient> =>
  Layer.effect(
    Database,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const tables = new Map<string, TableInfo>(
        deriveSchema(config).map((t) => [t.name, indexTable(t)] as const),
      );

      const toError = (message: string) => (cause: SqlError) =>
        new DatabaseError({ message, cause });

      // Like `toError`, but classifies unique-constraint violations so the write
      // core can surface a typed `ConflictError` instead of a generic failure.
      const toWriteError = (table: TableInfo, message: string) => (cause: SqlError) => {
        const conflict = detectConflict(table, errorText(cause));
        return conflict === null
          ? new DatabaseError({ message, cause })
          : new DatabaseError({
              message,
              cause,
              conflict: true,
              field: conflict.field ?? undefined,
            });
      };

      // Re-read a row by id (ignoring soft-delete state) — the canonical row the
      // write methods echo back to the caller after a mutation.
      const reread = (table: TableInfo, id: string) =>
        sql<Record<string, unknown>>`
          SELECT * FROM ${sql(table.name)} WHERE ${sql("id")} = ${id} LIMIT 1
        `.pipe(
          Effect.mapError(toError(`Failed to read "${table.name}/${id}".`)),
          Effect.map((rows) => (rows[0] === undefined ? null : mapRow(table, rows[0]))),
        );

      const requireTable = (collection: string) =>
        Effect.gen(function* () {
          const table = tables.get(collection);
          if (table === undefined) {
            return yield* new DatabaseError({ message: `Unknown collection "${collection}".` });
          }
          return table;
        });

      const list = (collection: string, opts: ListOpts = {}) =>
        Effect.gen(function* () {
          const table = tables.get(collection);
          if (table === undefined) {
            return yield* new DatabaseError({ message: `Unknown collection "${collection}".` });
          }

          const orderField = opts.orderBy ?? "id";
          const orderInfo = table.byField.get(orderField);
          if (orderInfo === undefined) {
            return yield* new DatabaseError({
              message: `Unknown orderBy field "${orderField}" on "${collection}".`,
            });
          }
          const orderColumn = orderInfo.name;

          const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
          const direction = opts.direction === "asc" ? "asc" : "desc";
          const keyword = sql.literal(direction === "asc" ? "ASC" : "DESC");
          const op = sql.literal(direction === "asc" ? ">" : "<");

          const conditions: Array<Fragment> = [sql`${sql("deleted_at")} IS NULL`];
          if (opts.cursor !== undefined) {
            const decoded = decodeCursor(opts.cursor);
            if (Option.isSome(decoded)) {
              const cursor = decoded.value;
              // A cursor is only valid for the exact ordering it was minted under;
              // reusing it under a different orderBy/direction would compare a
              // value against the wrong column and silently corrupt pages.
              if (cursor.orderBy !== orderField || cursor.direction !== direction) {
                return yield* new DatabaseError({
                  message: `Cursor was minted for orderBy "${cursor.orderBy}"/${cursor.direction}, not "${orderField}"/${direction}.`,
                });
              }
              const { value, id } = cursor;
              if (orderColumn === "id") {
                conditions.push(sql`${sql("id")} ${op} ${id}`);
              } else if (value === null) {
                // The boundary row is already in the trailing NULL partition;
                // only later NULL rows (by id) remain.
                conditions.push(
                  sql.and([sql`${sql(orderColumn)} IS NULL`, sql`${sql("id")} ${op} ${id}`]),
                );
              } else {
                // Ordering is `NULLS LAST`: rows after a non-null boundary are the
                // remaining non-null values, the equal-value id tiebreak, then the
                // entire NULL partition. The explicit `IS NULL` arm is what keeps
                // NULL-valued rows from being silently dropped from pagination.
                conditions.push(
                  sql.or([
                    sql`${sql(orderColumn)} ${op} ${value}`,
                    sql.and([sql`${sql(orderColumn)} = ${value}`, sql`${sql("id")} ${op} ${id}`]),
                    sql`${sql(orderColumn)} IS NULL`,
                  ]),
                );
              }
            }
          }

          // Always `NULLS LAST` so NULL placement is deterministic across SQLite
          // (NULLs sort first by default) and Postgres (NULLs sort last for DESC),
          // which the keyset predicate above relies on. `id` is never NULL.
          const orderClause =
            orderColumn === "id"
              ? sql`${sql("id")} ${keyword}`
              : sql`${sql(orderColumn)} ${keyword} NULLS LAST, ${sql("id")} ${keyword}`;

          const rows = yield* sql<Record<string, unknown>>`
            SELECT * FROM ${sql(table.name)}
            WHERE ${sql.and(conditions)}
            ORDER BY ${orderClause}
            LIMIT ${limit + 1}
          `.pipe(Effect.mapError(toError(`Failed to list "${collection}".`)));

          const hasMore = rows.length > limit;
          const page = hasMore ? rows.slice(0, limit) : rows;
          const last = page.at(-1);
          const nextCursor =
            hasMore && last !== undefined
              ? encodeCursor({
                  value: toCursorValue(last[orderColumn]),
                  id: String(last.id),
                  orderBy: orderField,
                  direction,
                })
              : null;

          return {
            documents: page.map((row) => mapRow(table, row)),
            nextCursor,
          } satisfies ListResult;
        });

      const get = (collection: string, id: string) =>
        Effect.gen(function* () {
          const table = tables.get(collection);
          if (table === undefined) {
            return yield* new DatabaseError({ message: `Unknown collection "${collection}".` });
          }
          const rows = yield* sql<Record<string, unknown>>`
            SELECT * FROM ${sql(table.name)}
            WHERE ${sql("id")} = ${id} AND ${sql("deleted_at")} IS NULL
            LIMIT 1
          `.pipe(Effect.mapError(toError(`Failed to get "${collection}/${id}".`)));
          const row = rows[0];
          return row === undefined ? null : mapRow(table, row);
        });

      const findOne = (collection: string, field: string, value: FieldValue) =>
        Effect.gen(function* () {
          const table = tables.get(collection);
          if (table === undefined) {
            return yield* new DatabaseError({ message: `Unknown collection "${collection}".` });
          }
          const info = table.byField.get(field);
          if (info === undefined) {
            return yield* new DatabaseError({
              message: `Unknown field "${field}" on "${collection}".`,
            });
          }
          const rows = yield* sql<Record<string, unknown>>`
            SELECT * FROM ${sql(table.name)}
            WHERE ${sql(info.name)} = ${value} AND ${sql("deleted_at")} IS NULL
            LIMIT 1
          `.pipe(Effect.mapError(toError(`Failed to find "${collection}" by "${field}".`)));
          const row = rows[0];
          return row === undefined ? null : mapRow(table, row);
        });

      const create = (collection: string, values: Document) =>
        Effect.gen(function* () {
          const table = yield* requireTable(collection);
          const now = yield* Clock.currentTimeMillis;
          const id = crypto.randomUUID();
          const row = encodeRow(table, {
            ...values,
            id,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          yield* sql`INSERT INTO ${sql(table.name)} ${sql.insert(row)}`.pipe(
            Effect.mapError(toWriteError(table, `Failed to create "${collection}".`)),
          );
          const stored = yield* reread(table, id);
          return stored === undefined || stored === null
            ? yield* new DatabaseError({
                message: `Created "${collection}/${id}" vanished on read.`,
              })
            : stored;
        });

      const update = (collection: string, id: string, values: Document) =>
        Effect.gen(function* () {
          const table = yield* requireTable(collection);
          // Only touch a live row; a missing/soft-deleted target updates nothing.
          const live = yield* get(collection, id);
          if (live === null) return null;
          const now = yield* Clock.currentTimeMillis;
          const row = encodeRow(table, { ...values, updatedAt: now });
          yield* sql`
            UPDATE ${sql(table.name)} SET ${sql.update(row)}
            WHERE ${sql("id")} = ${id} AND ${sql("deleted_at")} IS NULL
          `.pipe(Effect.mapError(toWriteError(table, `Failed to update "${collection}/${id}".`)));
          return yield* reread(table, id);
        });

      const softDelete = (collection: string, id: string) =>
        Effect.gen(function* () {
          const table = yield* requireTable(collection);
          const live = yield* get(collection, id);
          if (live === null) return false;
          const now = yield* Clock.currentTimeMillis;
          yield* sql`
            UPDATE ${sql(table.name)} SET ${sql("deleted_at")} = ${now}
            WHERE ${sql("id")} = ${id} AND ${sql("deleted_at")} IS NULL
          `.pipe(Effect.mapError(toError(`Failed to delete "${collection}/${id}".`)));
          return true;
        });

      const hardDelete = (collection: string, id: string) =>
        Effect.gen(function* () {
          const table = yield* requireTable(collection);
          const existing = yield* reread(table, id);
          if (existing === null) return false;
          yield* sql`DELETE FROM ${sql(table.name)} WHERE ${sql("id")} = ${id}`.pipe(
            Effect.mapError(toError(`Failed to purge "${collection}/${id}".`)),
          );
          return true;
        });

      const restore = (collection: string, id: string) =>
        Effect.gen(function* () {
          const table = yield* requireTable(collection);
          const existing = yield* reread(table, id);
          // Only a soft-deleted row can be restored; live or missing → no-op.
          if (existing === null || existing.deletedAt === null) return null;
          const now = yield* Clock.currentTimeMillis;
          yield* sql`
            UPDATE ${sql(table.name)}
            SET ${sql("deleted_at")} = ${null}, ${sql("updated_at")} = ${now}
            WHERE ${sql("id")} = ${id}
          `.pipe(Effect.mapError(toError(`Failed to restore "${collection}/${id}".`)));
          return yield* reread(table, id);
        });

      return Database.of({
        list,
        get,
        findOne,
        create,
        update,
        softDelete,
        hardDelete,
        restore,
      });
    }),
  );
