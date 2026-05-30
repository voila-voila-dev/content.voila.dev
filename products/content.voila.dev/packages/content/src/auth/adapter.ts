// Better Auth bridged onto the engine's `@effect/sql` `SqlClient` — a single
// connection shared with the rest of the engine (no second driver, no second
// pool). `createAdapter` (better-auth's factory) handles field-name mapping and
// the high-level query surface; this module implements the low-level CRUD over
// `SqlClient`, running each statement through a captured Effect `Runtime` so the
// async adapter contract is satisfied without leaking `Effect` into better-auth.
//
// Value representation: auth tables store dates as epoch-ms `INTEGER` and
// booleans as `0/1` (see `./schema`). We declare `supportsDates`/
// `supportsBooleans` to better-auth (so its factory hands us real `Date`/
// `boolean` values rather than pre-stringifying), then convert at the SQL
// boundary using the authoritative per-column types from the resolved schema.

import type { SqlClient } from "@effect/sql/SqlClient";
import { type CustomAdapter, createAdapter } from "better-auth/adapters";
import { Runtime } from "effect";

type ColumnType = "string" | "number" | "boolean" | "date" | (string & {});

interface Where {
  readonly field: string;
  readonly value: unknown;
  readonly operator: string;
  readonly connector: "AND" | "OR";
}

// Map every table's DB column name → its declared type, from better-auth's
// resolved schema. Both the model key and the physical table name are indexed
// so a `getModelName`-mapped table still resolves. `id` is always a string PK.
const buildColumnTypes = (
  // biome-ignore lint/suspicious/noExplicitAny: better-auth's schema shape is opaque + version-fluid.
  schema: Record<string, { modelName?: string; fields: Record<string, any> }>,
): Map<string, Map<string, ColumnType>> => {
  const tables = new Map<string, Map<string, ColumnType>>();
  for (const [model, table] of Object.entries(schema)) {
    const cols = new Map<string, ColumnType>([["id", "string"]]);
    for (const [field, attr] of Object.entries(table.fields)) {
      cols.set(attr.fieldName ?? field, attr.type as ColumnType);
    }
    tables.set(model, cols);
    if (table.modelName) tables.set(table.modelName, cols);
  }
  return tables;
};

// Coerce a JS value to its stored form for a column. Dates → epoch ms, booleans
// → 0/1; everything else passes through (the driver binds strings/numbers/null).
const toStored = (type: ColumnType | undefined, value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (type === "date" && value instanceof Date) return value.getTime();
  if (type === "boolean") return value ? 1 : 0;
  return value;
};

// Inverse of `toStored`: rebuild the JS value better-auth's output transform
// expects (real `Date`/`boolean`) from the raw driver row.
const fromStored = (type: ColumnType | undefined, value: unknown): unknown => {
  if (value === null || value === undefined) return null;
  if (type === "date") return new Date(Number(value));
  if (type === "boolean") return value === 1 || value === true;
  return value;
};

const mapRow = (
  cols: Map<string, ColumnType>,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key] = fromStored(cols.get(key), value);
  return out;
};

// Render one `Where` clause to a SQL fragment + its bound params. String LIKE
// patterns escape `%`/`_` so user input can't inject wildcards.
const renderClause = (
  cols: Map<string, ColumnType>,
  where: Where,
): { readonly sql: string; readonly params: ReadonlyArray<unknown> } => {
  const col = `"${where.field}"`;
  const type = cols.get(where.field);
  const bind = (v: unknown) => toStored(type, v);
  const like = (pattern: (escaped: string) => string) => {
    const escaped = String(where.value).replace(/[%_\\]/g, (c) => `\\${c}`);
    return { sql: `${col} LIKE ? ESCAPE '\\'`, params: [pattern(escaped)] };
  };
  switch (where.operator) {
    case "ne":
      return { sql: `${col} != ?`, params: [bind(where.value)] };
    case "lt":
      return { sql: `${col} < ?`, params: [bind(where.value)] };
    case "lte":
      return { sql: `${col} <= ?`, params: [bind(where.value)] };
    case "gt":
      return { sql: `${col} > ?`, params: [bind(where.value)] };
    case "gte":
      return { sql: `${col} >= ?`, params: [bind(where.value)] };
    case "in":
    case "not_in": {
      const values = (Array.isArray(where.value) ? where.value : [where.value]) as unknown[];
      if (values.length === 0)
        return { sql: where.operator === "in" ? "0 = 1" : "1 = 1", params: [] };
      const op = where.operator === "in" ? "IN" : "NOT IN";
      return {
        sql: `${col} ${op} (${values.map(() => "?").join(", ")})`,
        params: values.map(bind),
      };
    }
    case "contains":
      return like((v) => `%${v}%`);
    case "starts_with":
      return like((v) => `${v}%`);
    case "ends_with":
      return like((v) => `%${v}`);
    default:
      return { sql: `${col} = ?`, params: [bind(where.value)] };
  }
};

const renderWhere = (
  cols: Map<string, ColumnType>,
  where: ReadonlyArray<Where> | undefined,
): { readonly sql: string; readonly params: ReadonlyArray<unknown> } => {
  if (!where || where.length === 0) return { sql: "", params: [] };
  const params: unknown[] = [];
  const parts = where.map((clause, i) => {
    const rendered = renderClause(cols, clause);
    params.push(...rendered.params);
    return (i === 0 ? "" : ` ${clause.connector} `) + rendered.sql;
  });
  return { sql: ` WHERE ${parts.join("")}`, params };
};

/**
 * The better-auth adapter factory bound to a `SqlClient`. Pass the resolved
 * client and a `Runtime` (captured inside the `Auth` layer) — the returned
 * value is a better-auth `database` option: `(options) => Adapter`.
 */
export const makeVoilaSqlAdapter = (sql: SqlClient, runtime: Runtime.Runtime<never>) => {
  const run = <A>(effect: import("effect/Effect").Effect<A, unknown, never>): Promise<A> =>
    Runtime.runPromise(runtime)(effect as never) as Promise<A>;
  const query = (text: string, params: ReadonlyArray<unknown>) =>
    run(sql.unsafe<Record<string, unknown>>(text, params as Array<never>));

  return createAdapter({
    config: {
      adapterId: "voila-sql",
      adapterName: "Voila SQL Adapter",
      supportsJSON: false,
      supportsDates: true,
      supportsBooleans: true,
      supportsNumericIds: false,
      usePlural: false,
    },
    // biome-ignore lint/suspicious/noExplicitAny: bridge two opaque generic surfaces (better-auth factory ⇄ SqlClient).
    adapter: ({ schema }: any) => {
      const tables = buildColumnTypes(schema);
      const colsOf = (model: string) => tables.get(model) ?? new Map<string, ColumnType>();

      const findMany = async ({
        model,
        where,
        limit,
        offset,
        sortBy,
      }: {
        model: string;
        where?: ReadonlyArray<Where>;
        limit?: number;
        offset?: number;
        sortBy?: { field: string; direction: "asc" | "desc" };
      }) => {
        const cols = colsOf(model);
        const clause = renderWhere(cols, where);
        const order = sortBy
          ? ` ORDER BY "${sortBy.field}" ${sortBy.direction === "desc" ? "DESC" : "ASC"}`
          : "";
        const lim = typeof limit === "number" ? ` LIMIT ${limit}` : "";
        const off = typeof offset === "number" ? ` OFFSET ${offset}` : "";
        const rows = await query(
          `SELECT * FROM "${model}"${clause.sql}${order}${lim}${off}`,
          clause.params,
        );
        return rows.map((row) => mapRow(cols, row));
      };

      // The concrete CRUD impl below is non-generic; better-auth's `CustomAdapter`
      // methods are generic over the row type `T`. The `as unknown as` is the
      // seam between this driver and that opaque generic surface (cf. the RPC
      // handler cast in `server/handlers.ts`).
      const customAdapter = {
        create: async ({ model, data }: { model: string; data: Record<string, unknown> }) => {
          const cols = colsOf(model);
          const keys = Object.keys(data);
          await query(
            `INSERT INTO "${model}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys
              .map(() => "?")
              .join(", ")})`,
            keys.map((k) => toStored(cols.get(k), data[k])),
          );
          // `data` is already JS-typed (Date/boolean) — echo it as the output row.
          return data;
        },

        findOne: async ({ model, where }: { model: string; where: ReadonlyArray<Where> }) => {
          const rows = await findMany({ model, where, limit: 1 });
          return rows[0] ?? null;
        },

        findMany,

        count: async ({ model, where }: { model: string; where?: ReadonlyArray<Where> }) => {
          const cols = colsOf(model);
          const clause = renderWhere(cols, where);
          const rows = await query(
            `SELECT COUNT(*) AS count FROM "${model}"${clause.sql}`,
            clause.params,
          );
          return Number(rows[0]?.count ?? 0);
        },

        update: async ({
          model,
          where,
          update,
        }: {
          model: string;
          where: ReadonlyArray<Where>;
          update: Record<string, unknown>;
        }) => {
          const cols = colsOf(model);
          const keys = Object.keys(update);
          const clause = renderWhere(cols, where);
          await query(
            `UPDATE "${model}" SET ${keys.map((k) => `"${k}" = ?`).join(", ")}${clause.sql}`,
            [...keys.map((k) => toStored(cols.get(k), update[k])), ...clause.params],
          );
          const rows = await findMany({ model, where, limit: 1 });
          return rows[0] ?? null;
        },

        updateMany: async ({
          model,
          where,
          update,
        }: {
          model: string;
          where: ReadonlyArray<Where>;
          update: Record<string, unknown>;
        }) => {
          const cols = colsOf(model);
          const keys = Object.keys(update);
          const clause = renderWhere(cols, where);
          const before = await query(
            `SELECT COUNT(*) AS count FROM "${model}"${clause.sql}`,
            clause.params,
          );
          await query(
            `UPDATE "${model}" SET ${keys.map((k) => `"${k}" = ?`).join(", ")}${clause.sql}`,
            [...keys.map((k) => toStored(cols.get(k), update[k])), ...clause.params],
          );
          return Number(before[0]?.count ?? 0);
        },

        delete: async ({ model, where }: { model: string; where: ReadonlyArray<Where> }) => {
          const clause = renderWhere(colsOf(model), where);
          await query(`DELETE FROM "${model}"${clause.sql}`, clause.params);
        },

        deleteMany: async ({ model, where }: { model: string; where: ReadonlyArray<Where> }) => {
          const cols = colsOf(model);
          const clause = renderWhere(cols, where);
          const before = await query(
            `SELECT COUNT(*) AS count FROM "${model}"${clause.sql}`,
            clause.params,
          );
          await query(`DELETE FROM "${model}"${clause.sql}`, clause.params);
          return Number(before[0]?.count ?? 0);
        },

        // Atomic single-row consume — `DELETE … WHERE rowid = (SELECT … LIMIT 1)
        // RETURNING *` — the race-safe primitive for one-time magic-link tokens.
        consumeOne: async ({ model, where }: { model: string; where: ReadonlyArray<Where> }) => {
          const cols = colsOf(model);
          const clause = renderWhere(cols, where);
          const rows = await query(
            `DELETE FROM "${model}" WHERE rowid = (SELECT rowid FROM "${model}"${clause.sql} LIMIT 1) RETURNING *`,
            clause.params,
          );
          return rows[0] ? mapRow(cols, rows[0]) : null;
        },
      };
      return customAdapter as unknown as CustomAdapter;
    },
  });
};
