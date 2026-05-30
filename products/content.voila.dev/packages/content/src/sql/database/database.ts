// `DatabaseLive` — the default `Database` implementation over the `@effect/sql`
// `SqlClient` seam. Reads the dialect-neutral table descriptors from
// `deriveSchema(config)` to map snake_case rows back to camelCase documents
// (parsing JSON columns) and to validate `orderBy` against real columns.

import { SqlClient } from "@effect/sql/SqlClient";
import type { SqlError } from "@effect/sql/SqlError";
import type { Fragment } from "@effect/sql/Statement";
import { Effect, Layer, Option } from "effect";
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

      return Database.of({ list, get, findOne });
    }),
  );
