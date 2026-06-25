// `makeDatabase` — the default `Database` implementation over a `SqlDriver`.
// Reads the dialect-neutral table descriptors from `deriveSchema(config)` to map
// snake_case rows back to camelCase documents (parsing JSON columns, smoothing
// SQLite/Postgres value-shape differences) and to validate `orderBy` against real
// columns. The keyset pagination, soft-delete scoping, and unique-conflict
// classification all live here; the driver only runs strings + `?` params.

import type { NormalizedConfig } from "../../config/config";
import type { FieldsMap } from "../../config/schema/fields";
import {
  type ColumnSchema,
  deriveSchema,
  REVISIONS_TABLE,
  SEARCH_TABLE,
  type TableSchema,
} from "../../sql";
import { type CursorPosition, decodeCursor, encodeCursor } from "./cursor";
import type { SqlDriver, SqlRow, SqlValue } from "./driver";
import { and, buildInsert, buildUpdateSet, frag, or, quoteId, type Sql } from "./query";
import {
  buildSearchContent,
  resolveSearchFields,
  type SearchFieldInfo,
  toMatchQuery,
} from "./search-content";
import type {
  Database,
  Document,
  DraftFilter,
  FieldValue,
  FilterOp,
  ListFilter,
  ListOpts,
  ListResult,
  OrderDirection,
  PublishOpts,
  Revision,
  RevisionListOpts,
  RevisionListResult,
  SearchOpts,
  SearchResult,
} from "./types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** A query or mapping failure. `conflict` is set when the failure is a
 *  unique-constraint violation; `field` carries the offending column's field
 *  name when the driver reveals it. The driver's error is kept as `cause`. */
export class DatabaseError extends Error {
  readonly conflict: boolean;
  readonly field: string | undefined;

  constructor(opts: {
    readonly message: string;
    readonly cause?: unknown;
    readonly conflict?: boolean;
    readonly field?: string;
  }) {
    super(opts.message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "DatabaseError";
    this.conflict = opts.conflict ?? false;
    this.field = opts.field;
  }
}

interface ColumnInfo {
  readonly name: string;
  readonly fieldName: string;
  readonly isJson: boolean;
  readonly isBoolean: boolean;
  readonly isTimestamp: boolean;
}

export interface TableInfo {
  readonly name: string;
  /** Indexed by column name (snake_case) for row→document mapping. */
  readonly byColumn: ReadonlyMap<string, ColumnInfo>;
  /** Indexed by field name (camelCase) for `orderBy` resolution. */
  readonly byField: ReadonlyMap<string, ColumnInfo>;
  /** True when the collection opted into draft/published workflow. */
  readonly drafts: boolean;
  /** True when the collection opted into version history. */
  readonly revisions: boolean;
  /** Set for singleton tables: the fixed id (= slug) the DDL `CHECK` pins the
   *  one row to. `create` uses it instead of minting a UUID. */
  readonly singletonId: string | undefined;
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
  return {
    name: table.name,
    byColumn,
    byField,
    drafts: table.drafts === true,
    revisions: table.revisions === true,
    singletonId: table.singletonCheck?.id,
  };
};

export const mapRow = (table: TableInfo, row: SqlRow): Document => {
  const doc: Document = {};
  for (const [column, value] of Object.entries(row)) {
    const info = table.byColumn.get(column);
    doc[info?.fieldName ?? column] = normalize(info, value);
  }
  return doc;
};

// Inverse of `normalize`: take a canonical (decoded-then-re-encoded) field value
// and render the storage form each driver expects. SQLite/D1 store booleans as
// 0/1 and JSON as text; timestamps are epoch-ms integers. (Postgres takes native
// booleans — handled when the live pg driver lands; only SQLite/D1 run today.)
const encodeValue = (info: ColumnInfo | undefined, value: unknown): SqlValue => {
  if (value === null || value === undefined) return null;
  if (info?.isJson) return typeof value === "string" ? value : JSON.stringify(value);
  if (info?.isBoolean) return value ? 1 : 0;
  if (info?.isTimestamp) return value instanceof Date ? value.getTime() : (value as SqlValue);
  // Unknown fields pass through under their own name so a misconfigured write
  // surfaces as a SQL error rather than being silently dropped.
  return value as SqlValue;
};

// Canonical camelCase document → snake_case storage columns (the inverse of `mapRow`).
export const encodeRow = (table: TableInfo, doc: Document): Record<string, SqlValue> => {
  const row: Record<string, SqlValue> = {};
  for (const [field, value] of Object.entries(doc)) {
    const info = table.byField.get(field);
    row[info?.name ?? field] = encodeValue(info, value);
  }
  return row;
};

// The driver's real message may live on a nested `cause`, so flatten the whole
// chain before matching constraint text.
const errorText = (error: unknown): string => {
  const parts: Array<string> = [];
  let cause: unknown = error;
  for (let depth = 0; cause != null && depth < 5; depth++) {
    if (typeof cause === "object" && cause !== null && "message" in cause) {
      parts.push(String((cause as { readonly message: unknown }).message));
    } else {
      parts.push(String(cause));
    }
    cause =
      typeof cause === "object" && cause !== null
        ? (cause as { cause?: unknown }).cause
        : undefined;
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

// The `WHERE` fragment that scopes a draft-enabled table's reads to the
// requested `status`, or `null` when no scoping applies (non-draft table, or
// `any`). "Live" = published *and* any scheduled `publishedAt` has elapsed;
// `scheduled` is the complement within published rows (a future `publishedAt`).
function draftPredicate(table: TableInfo, status: DraftFilter): Sql | null {
  if (!table.drafts || status === "any") return null;
  if (status === "draft") return frag(`${quoteId("status")} = ?`, ["draft"]);
  if (status === "scheduled") {
    return and([
      frag(`${quoteId("status")} = ?`, ["published"]),
      frag(`${quoteId("published_at")} > ?`, [Date.now()]),
    ]);
  }
  return and([
    frag(`${quoteId("status")} = ?`, ["published"]),
    or([
      frag(`${quoteId("published_at")} IS NULL`),
      frag(`${quoteId("published_at")} <= ?`, [Date.now()]),
    ]),
  ]);
}

// SQL operator per filter op. `contains` is handled separately (a `LIKE` with
// wildcards around the value), so it isn't in this map.
const FILTER_SQL_OP: Record<Exclude<FilterOp, "contains">, string> = {
  eq: "=",
  ne: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
};

// The `WHERE` fragment for one list filter, resolved against a known column.
// `contains` matches a substring (case-insensitive `LIKE`); the rest compare the
// value encoded to the column's storage form (so a boolean binds as 0/1, etc.).
function filterPredicate(info: ColumnInfo, filter: ListFilter): Sql {
  const col = quoteId(info.name);
  if (filter.op === "contains") {
    return frag(`${col} LIKE ?`, [`%${String(filter.value)}%`]);
  }
  return frag(`${col} ${FILTER_SQL_OP[filter.op]} ?`, [encodeValue(info, filter.value)]);
}

// Snapshot field names the server owns. Stripped when a revision is restored —
// `update` re-stamps the timestamps, and publish state is managed by the
// publish routes, not by time travel.
const REVISION_SYSTEM_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "status",
  "publishedAt",
]);

export function makeDatabase(config: NormalizedConfig, driver: SqlDriver): Database {
  // Engine-owned system tables (the revision store) ship with the schema but
  // aren't collections — they never resolve through `requireTable`.
  const tables = new Map<string, TableInfo>(
    deriveSchema(config)
      .filter((t) => t.system !== true)
      .map((t) => [t.name, indexTable(t)] as const),
  );

  const requireTable = (collection: string): TableInfo => {
    const table = tables.get(collection);
    if (table === undefined) {
      throw new DatabaseError({ message: `Unknown collection "${collection}".` });
    }
    return table;
  };

  // The searchable field set per collection slug, resolved from each
  // collection's `search` opt against its fields. Only present for collections
  // that opted in (and selected at least one field); drives both the
  // index-sync-on-write and the `search` query.
  const searchable = new Map<string, ReadonlyArray<SearchFieldInfo>>();
  {
    const collections = config.collections as Record<
      string,
      { fields: FieldsMap; search?: boolean | ReadonlyArray<string> }
    >;
    for (const [slug, collection] of Object.entries(collections)) {
      const fields = resolveSearchFields(collection.fields, collection.search);
      if (fields !== null && fields.length > 0) searchable.set(slug, fields);
    }
  }

  const requireSearch = (
    collection: string,
  ): { readonly table: TableInfo; readonly fields: ReadonlyArray<SearchFieldInfo> } => {
    const table = requireTable(collection);
    const fields = searchable.get(collection);
    if (fields === undefined) {
      throw new DatabaseError({ message: `Collection "${collection}" is not search-enabled.` });
    }
    return { table, fields };
  };

  // Run a read/write, wrapping any driver rejection as a `DatabaseError`.
  const exec = async <A>(message: string, fn: () => Promise<A>): Promise<A> => {
    try {
      return await fn();
    } catch (cause) {
      throw new DatabaseError({ message, cause });
    }
  };

  // Like `exec`, but classifies unique-constraint violations so callers can
  // surface a typed conflict instead of a generic failure.
  const execWrite = async <A>(
    table: TableInfo,
    message: string,
    fn: () => Promise<A>,
  ): Promise<A> => {
    try {
      return await fn();
    } catch (cause) {
      const conflict = detectConflict(table, errorText(cause));
      if (conflict === null) throw new DatabaseError({ message, cause });
      throw new DatabaseError({
        message,
        cause,
        conflict: true,
        field: conflict.field ?? undefined,
      });
    }
  };

  // Append a version-history snapshot of a just-written row. `rev` is assigned
  // by an inline `MAX(rev) + 1` subquery, atomic under SQLite/D1's single
  // writer. No-op unless the collection opted into revisions.
  const snapshot = async (table: TableInfo, doc: Document): Promise<void> => {
    if (!table.revisions) return;
    const documentId = String(doc.id);
    await exec(`Failed to snapshot "${table.name}/${documentId}".`, () =>
      driver.run(
        `INSERT INTO ${quoteId(REVISIONS_TABLE)} ` +
          `(${quoteId("id")}, ${quoteId("collection")}, ${quoteId("document_id")}, ${quoteId("rev")}, ${quoteId("data")}, ${quoteId("created_at")}) ` +
          `VALUES (?, ?, ?, (SELECT COALESCE(MAX(${quoteId("rev")}), 0) + 1 FROM ${quoteId(REVISIONS_TABLE)} ` +
          `WHERE ${quoteId("collection")} = ? AND ${quoteId("document_id")} = ?), ?, ?)`,
        [
          crypto.randomUUID(),
          table.name,
          documentId,
          table.name,
          documentId,
          JSON.stringify(doc),
          Date.now(),
        ],
      ),
    );
  };

  // Drop a document's row(s) from the full-text index. No-op unless the
  // collection opted into search.
  const removeSearch = async (collection: string, id: string): Promise<void> => {
    if (!searchable.has(collection)) return;
    await exec(`Failed to de-index "${collection}/${id}".`, () =>
      driver.run(
        `DELETE FROM ${quoteId(SEARCH_TABLE)} WHERE ${quoteId("collection")} = ? AND ${quoteId("doc_id")} = ?`,
        [collection, id],
      ),
    );
  };

  // Re-index a just-written row: delete the stale entry, then insert the fresh
  // content (FTS5 has no in-place update). No-op unless the collection opted in.
  const syncSearch = async (collection: string, doc: Document): Promise<void> => {
    const fields = searchable.get(collection);
    if (fields === undefined) return;
    const id = String(doc.id);
    await removeSearch(collection, id);
    const content = buildSearchContent(fields, doc);
    await exec(`Failed to index "${collection}/${id}".`, () =>
      driver.run(
        `INSERT INTO ${quoteId(SEARCH_TABLE)} (${quoteId("collection")}, ${quoteId("doc_id")}, ${quoteId("content")}) VALUES (?, ?, ?)`,
        [collection, id, content],
      ),
    );
  };

  // Re-read a row by id (ignoring soft-delete state) — the canonical row the
  // write methods echo back after a mutation.
  const reread = async (table: TableInfo, id: string): Promise<Document | null> => {
    const rows = await exec(`Failed to read "${table.name}/${id}".`, () =>
      driver.all(`SELECT * FROM ${quoteId(table.name)} WHERE ${quoteId("id")} = ? LIMIT 1`, [id]),
    );
    const row = rows[0];
    return row === undefined ? null : mapRow(table, row);
  };

  const list = async (collection: string, opts: ListOpts = {}): Promise<ListResult> => {
    const table = requireTable(collection);

    const orderField = opts.orderBy ?? "id";
    const orderInfo = table.byField.get(orderField);
    if (orderInfo === undefined) {
      throw new DatabaseError({
        message: `Unknown orderBy field "${orderField}" on "${collection}".`,
      });
    }
    const orderColumn = orderInfo.name;

    const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
    const direction: OrderDirection = opts.direction === "asc" ? "asc" : "desc";
    const keyword = direction === "asc" ? "ASC" : "DESC";
    const op = direction === "asc" ? ">" : "<";

    // The cursor predicate is appended after this — the total count must cover
    // every page, so it's computed against the cursor-free scope below.
    const scopeConditions: Array<Sql> = [frag(`${quoteId("deleted_at")} IS NULL`)];
    const draftScope = draftPredicate(table, opts.status ?? "published");
    if (draftScope !== null) scopeConditions.push(draftScope);

    // Field filters fold into the scope (before the cursor) so both the page
    // query and the optional COUNT honor them. Unknown fields are rejected, the
    // same as `orderBy`.
    for (const filter of opts.filters ?? []) {
      const info = table.byField.get(filter.field);
      if (info === undefined) {
        throw new DatabaseError({
          message: `Unknown filter field "${filter.field}" on "${collection}".`,
        });
      }
      scopeConditions.push(filterPredicate(info, filter));
    }

    const conditions: Array<Sql> = [...scopeConditions];
    if (opts.cursor !== undefined) {
      const cursor = decodeCursor(opts.cursor);
      if (cursor !== null) {
        // A cursor is only valid for the exact ordering it was minted under;
        // reusing it under a different orderBy/direction would compare a value
        // against the wrong column and silently corrupt pages.
        if (cursor.orderBy !== orderField || cursor.direction !== direction) {
          throw new DatabaseError({
            message: `Cursor was minted for orderBy "${cursor.orderBy}"/${cursor.direction}, not "${orderField}"/${direction}.`,
          });
        }
        const { value, id } = cursor;
        if (orderColumn === "id") {
          conditions.push(frag(`${quoteId("id")} ${op} ?`, [id]));
        } else if (value === null) {
          // The boundary row is already in the trailing NULL partition; only
          // later NULL rows (by id) remain.
          conditions.push(
            and([frag(`${quoteId(orderColumn)} IS NULL`), frag(`${quoteId("id")} ${op} ?`, [id])]),
          );
        } else {
          // Ordering is `NULLS LAST`: rows after a non-null boundary are the
          // remaining non-null values, the equal-value id tiebreak, then the
          // entire NULL partition. The explicit `IS NULL` arm is what keeps
          // NULL-valued rows from being silently dropped from pagination.
          conditions.push(
            or([
              frag(`${quoteId(orderColumn)} ${op} ?`, [value]),
              and([
                frag(`${quoteId(orderColumn)} = ?`, [value]),
                frag(`${quoteId("id")} ${op} ?`, [id]),
              ]),
              frag(`${quoteId(orderColumn)} IS NULL`),
            ]),
          );
        }
      }
    }

    // Always `NULLS LAST` so NULL placement is deterministic across SQLite (NULLs
    // sort first by default) and Postgres (NULLs sort last for DESC), which the
    // keyset predicate above relies on. `id` is never NULL.
    const orderClause =
      orderColumn === "id"
        ? `${quoteId("id")} ${keyword}`
        : `${quoteId(orderColumn)} ${keyword} NULLS LAST, ${quoteId("id")} ${keyword}`;

    const where = and(conditions);
    const rows = await exec(`Failed to list "${collection}".`, () =>
      driver.all(
        `SELECT * FROM ${quoteId(table.name)} WHERE ${where.text} ORDER BY ${orderClause} LIMIT ${limit + 1}`,
        where.params,
      ),
    );

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

    const result: ListResult = { documents: page.map((row) => mapRow(table, row)), nextCursor };
    if (opts.count !== true) return result;

    const scope = and(scopeConditions);
    const counted = await exec(`Failed to count "${collection}".`, () =>
      driver.all(
        `SELECT COUNT(*) AS ${quoteId("n")} FROM ${quoteId(table.name)} WHERE ${scope.text}`,
        scope.params,
      ),
    );
    // bigint smooths a future pg driver's `COUNT(*)` (Postgres returns BIGINT).
    return { ...result, total: Number(counted[0]?.n ?? 0) };
  };

  const get = async (collection: string, id: string): Promise<Document | null> => {
    const table = requireTable(collection);
    const rows = await exec(`Failed to get "${collection}/${id}".`, () =>
      driver.all(
        `SELECT * FROM ${quoteId(table.name)} WHERE ${quoteId("id")} = ? AND ${quoteId("deleted_at")} IS NULL LIMIT 1`,
        [id],
      ),
    );
    const row = rows[0];
    return row === undefined ? null : mapRow(table, row);
  };

  const findOne = async (
    collection: string,
    field: string,
    value: FieldValue,
  ): Promise<Document | null> => {
    const table = requireTable(collection);
    const info = table.byField.get(field);
    if (info === undefined) {
      throw new DatabaseError({ message: `Unknown field "${field}" on "${collection}".` });
    }
    const rows = await exec(`Failed to find "${collection}" by "${field}".`, () =>
      driver.all(
        `SELECT * FROM ${quoteId(table.name)} WHERE ${quoteId(info.name)} = ? AND ${quoteId("deleted_at")} IS NULL LIMIT 1`,
        [value],
      ),
    );
    const row = rows[0];
    return row === undefined ? null : mapRow(table, row);
  };

  const create = async (collection: string, values: Document): Promise<Document> => {
    const table = requireTable(collection);
    const now = Date.now();
    // A singleton table's DDL pins its one row to `id = slug` via a CHECK
    // constraint — a random UUID could never insert.
    const id = table.singletonId ?? crypto.randomUUID();
    const row = encodeRow(table, {
      ...values,
      id,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      // Draft-enabled rows start unpublished; `publish` flips them live.
      ...(table.drafts ? { status: "draft", publishedAt: null } : {}),
    });
    const insert = buildInsert(table.name, row);
    await execWrite(table, `Failed to create "${collection}".`, () =>
      driver.run(insert.text, insert.params),
    );
    const stored = await reread(table, id);
    if (stored === null) {
      throw new DatabaseError({ message: `Created "${collection}/${id}" vanished on read.` });
    }
    await snapshot(table, stored);
    await syncSearch(collection, stored);
    return stored;
  };

  const update = async (
    collection: string,
    id: string,
    values: Document,
  ): Promise<Document | null> => {
    const table = requireTable(collection);
    // Only touch a live row; a missing/soft-deleted target updates nothing.
    const live = await get(collection, id);
    if (live === null) return null;
    const now = Date.now();
    const set = buildUpdateSet(encodeRow(table, { ...values, updatedAt: now }));
    await execWrite(table, `Failed to update "${collection}/${id}".`, () =>
      driver.run(
        `UPDATE ${quoteId(table.name)} SET ${set.text} WHERE ${quoteId("id")} = ? AND ${quoteId("deleted_at")} IS NULL`,
        [...set.params, id],
      ),
    );
    const stored = await reread(table, id);
    if (stored !== null) {
      await snapshot(table, stored);
      await syncSearch(collection, stored);
    }
    return stored;
  };

  const softDelete = async (collection: string, id: string): Promise<boolean> => {
    const table = requireTable(collection);
    const live = await get(collection, id);
    if (live === null) return false;
    await exec(`Failed to delete "${collection}/${id}".`, () =>
      driver.run(
        `UPDATE ${quoteId(table.name)} SET ${quoteId("deleted_at")} = ? WHERE ${quoteId("id")} = ? AND ${quoteId("deleted_at")} IS NULL`,
        [Date.now(), id],
      ),
    );
    // A soft-deleted row drops out of search; the read path also re-scopes, so
    // this just keeps the index from carrying stale text.
    await removeSearch(collection, id);
    return true;
  };

  const hardDelete = async (collection: string, id: string): Promise<boolean> => {
    const table = requireTable(collection);
    const existing = await reread(table, id);
    if (existing === null) return false;
    await exec(`Failed to purge "${collection}/${id}".`, () =>
      driver.run(`DELETE FROM ${quoteId(table.name)} WHERE ${quoteId("id")} = ?`, [id]),
    );
    await removeSearch(collection, id);
    return true;
  };

  const restore = async (collection: string, id: string): Promise<Document | null> => {
    const table = requireTable(collection);
    const existing = await reread(table, id);
    // Only a soft-deleted row can be restored; live or missing → no-op.
    if (existing === null || existing.deletedAt === null) return null;
    await exec(`Failed to restore "${collection}/${id}".`, () =>
      driver.run(
        `UPDATE ${quoteId(table.name)} SET ${quoteId("deleted_at")} = ?, ${quoteId("updated_at")} = ? WHERE ${quoteId("id")} = ?`,
        [null, Date.now(), id],
      ),
    );
    const stored = await reread(table, id);
    // A restored row rejoins the index with its current content.
    if (stored !== null) await syncSearch(collection, stored);
    return stored;
  };

  // Create-or-update the one row of a singleton table. Routed through `create`/
  // `update` so system-column stamping and revision snapshots stay in one place.
  const upsert = async (collection: string, values: Document): Promise<Document> => {
    const table = requireTable(collection);
    const id = table.singletonId;
    if (id === undefined) {
      throw new DatabaseError({ message: `Collection "${collection}" is not a singleton.` });
    }
    const existing = await reread(table, id);
    if (existing === null) return create(collection, values);
    // A soft-deleted singleton revives on write — there is no second row to
    // create, so a set-after-delete must resurrect the one row.
    if (existing.deletedAt !== null) await restore(collection, id);
    const stored = await update(collection, id, values);
    if (stored === null) {
      throw new DatabaseError({ message: `Upserted "${collection}/${id}" vanished on read.` });
    }
    return stored;
  };

  // Flip a live row's publish state. Shared by `publish`/`unpublish`: both set
  // `status` + `published_at` + `updated_at` on a non-soft-deleted row.
  const setPublishState = async (
    collection: string,
    id: string,
    status: "published" | "draft",
    publishedAt: number | null,
  ): Promise<Document | null> => {
    const table = requireTable(collection);
    if (!table.drafts) {
      throw new DatabaseError({ message: `Collection "${collection}" is not draft-enabled.` });
    }
    // Only a live (non-soft-deleted) row can change publish state.
    if ((await get(collection, id)) === null) return null;
    await exec(`Failed to set publish state on "${collection}/${id}".`, () =>
      driver.run(
        `UPDATE ${quoteId(table.name)} SET ${quoteId("status")} = ?, ${quoteId("published_at")} = ?, ${quoteId("updated_at")} = ? WHERE ${quoteId("id")} = ? AND ${quoteId("deleted_at")} IS NULL`,
        [status, publishedAt, Date.now(), id],
      ),
    );
    const stored = await reread(table, id);
    if (stored !== null) await snapshot(table, stored);
    return stored;
  };

  const publish = (
    collection: string,
    id: string,
    opts: PublishOpts = {},
  ): Promise<Document | null> =>
    setPublishState(collection, id, "published", opts.at ?? Date.now());

  const unpublish = (collection: string, id: string): Promise<Document | null> =>
    setPublishState(collection, id, "draft", null);

  const requireRevisions = (collection: string): TableInfo => {
    const table = requireTable(collection);
    if (!table.revisions) {
      throw new DatabaseError({ message: `Collection "${collection}" is not revisions-enabled.` });
    }
    return table;
  };

  // A stored snapshot row → the canonical `Revision`. `rev`/`created_at` come
  // back as numbers from SQLite/D1 (bigint/Date smoothed for a future pg driver).
  const mapRevision = (row: SqlRow): Revision => ({
    rev: Number(row.rev),
    createdAt: row.created_at instanceof Date ? row.created_at.getTime() : Number(row.created_at),
    doc: JSON.parse(String(row.data)) as Document,
  });

  const listRevisions = async (
    collection: string,
    id: string,
    opts: RevisionListOpts = {},
  ): Promise<RevisionListResult> => {
    const table = requireRevisions(collection);
    const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);

    // The cursor is the last page's lowest `rev` (history pages newest-first);
    // garbage is ignored the same way a malformed keyset cursor is.
    const before = opts.cursor !== undefined ? Number.parseInt(opts.cursor, 10) : Number.NaN;
    const conditions: Array<Sql> = [
      frag(`${quoteId("collection")} = ?`, [table.name]),
      frag(`${quoteId("document_id")} = ?`, [id]),
    ];
    if (Number.isFinite(before)) conditions.push(frag(`${quoteId("rev")} < ?`, [before]));

    const where = and(conditions);
    const rows = await exec(`Failed to list revisions of "${collection}/${id}".`, () =>
      driver.all(
        `SELECT * FROM ${quoteId(REVISIONS_TABLE)} WHERE ${where.text} ORDER BY ${quoteId("rev")} DESC LIMIT ${limit + 1}`,
        where.params,
      ),
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const revisions = page.map(mapRevision);
    const last = revisions.at(-1);
    return {
      revisions,
      nextCursor: hasMore && last !== undefined ? String(last.rev) : null,
    };
  };

  const getRevision = async (
    collection: string,
    id: string,
    rev: number,
  ): Promise<Revision | null> => {
    const table = requireRevisions(collection);
    const rows = await exec(`Failed to get revision ${rev} of "${collection}/${id}".`, () =>
      driver.all(
        `SELECT * FROM ${quoteId(REVISIONS_TABLE)} WHERE ${quoteId("collection")} = ? AND ${quoteId("document_id")} = ? AND ${quoteId("rev")} = ? LIMIT 1`,
        [table.name, id, rev],
      ),
    );
    const row = rows[0];
    return row === undefined ? null : mapRevision(row);
  };

  const restoreRevision = async (
    collection: string,
    id: string,
    rev: number,
  ): Promise<Document | null> => {
    const table = requireRevisions(collection);
    const revision = await getRevision(collection, id, rev);
    if (revision === null) return null;
    // Content fields only: system columns are stripped, and a field the config
    // no longer declares (snapshot predates a schema change) is dropped rather
    // than crashing the UPDATE on a missing column.
    const values: Document = {};
    for (const [field, value] of Object.entries(revision.doc)) {
      if (REVISION_SYSTEM_FIELDS.has(field)) continue;
      if (!table.byField.has(field)) continue;
      values[field] = value;
    }
    // `update` bumps `updatedAt` and appends the post-restore snapshot.
    return update(collection, id, values);
  };

  const search = async (
    collection: string,
    query: string,
    opts: SearchOpts = {},
  ): Promise<SearchResult> => {
    const { table } = requireSearch(collection);
    const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
    const match = toMatchQuery(query);
    if (match === null) return { documents: [] };

    // Rank candidate ids via FTS5 (bm25 `ORDER BY rank`), then load the real rows
    // through the normal read scoping so visibility (soft-delete + draft status)
    // never depends on the index being perfectly in sync.
    const ranked = await exec(`Failed to search "${collection}".`, () =>
      driver.all(
        `SELECT ${quoteId("doc_id")} FROM ${quoteId(SEARCH_TABLE)} ` +
          `WHERE ${quoteId(SEARCH_TABLE)} MATCH ? AND ${quoteId("collection")} = ? ` +
          `ORDER BY rank LIMIT ${limit}`,
        [match, collection],
      ),
    );
    const ids = ranked.map((row) => String(row.doc_id));
    if (ids.length === 0) return { documents: [] };

    const conditions: Array<Sql> = [frag(`${quoteId("deleted_at")} IS NULL`)];
    const draftScope = draftPredicate(table, opts.status ?? "published");
    if (draftScope !== null) conditions.push(draftScope);
    const placeholders = ids.map(() => "?").join(", ");
    conditions.push(frag(`${quoteId("id")} IN (${placeholders})`, ids));
    const where = and(conditions);
    const rows = await exec(`Failed to load search results for "${collection}".`, () =>
      driver.all(`SELECT * FROM ${quoteId(table.name)} WHERE ${where.text}`, where.params),
    );

    // SQL `IN (…)` doesn't preserve order — restore the bm25 ranking the index
    // returned, dropping any id the read scoping filtered out.
    const byId = new Map(rows.map((row) => [String(row.id), mapRow(table, row)]));
    const documents = ids
      .map((id) => byId.get(id))
      .filter((doc): doc is Document => doc !== undefined);
    return { documents };
  };

  return {
    list,
    get,
    findOne,
    create,
    update,
    upsert,
    softDelete,
    hardDelete,
    restore,
    publish,
    unpublish,
    listRevisions,
    getRevision,
    restoreRevision,
    search,
  };
}
