/**
 * Shared types and helpers used by every read handler.
 *
 * Drizzle is generic over its result kind (sync/async) and run-result; we
 * unify the SQLite-family adapters (`bun-sqlite`, `d1`) behind a single
 * `Drizzle` alias so handler code never has to branch on the driver. The
 * Postgres adapter has its own family — read handlers don't run against it
 * yet, so we keep the SQLite slice for now.
 *
 * Handlers are generic over `C extends AnyContent`. With the typed content
 * map in place, the row shape can be derived from the precise field record
 * of any matched collection/singleton — see `RowFromEntry` / `RowsOf`.
 *
 * `respond()` is the single place that converts a handler body's `Result`
 * into a wire response. It catches only true exceptions (driver errors,
 * programming bugs) and folds them into a generic `INTERNAL` 500, so domain
 * failures always flow through the typed `Result` channel.
 */

import type { DatabaseAdapter } from "@voila/content-database";
import type { AnyFieldDef, InferDoc } from "@voila/content-schema";
import type { InferSelectModel, Table } from "drizzle-orm";
import type {
  BaseSQLiteDatabase,
  SQLiteColumn,
  SQLiteTableWithColumns,
} from "drizzle-orm/sqlite-core";
import type { Result } from "../../shared/result.ts";
import type { AnyCollection, AnyContent, AnySingleton } from "../../types.ts";
import { type ApiFailure, errorResponse, internalFailure } from "../errors.ts";

/**
 * SQLite-family Drizzle client. Sync (`bun-sqlite`) and async (`d1`) collapse
 * to a single union; every operation is `await`ed regardless, so the call
 * site is identical.
 */
// biome-ignore lint/suspicious/noExplicitAny: TRunResult differs per driver (void vs D1Result); irrelevant for the read path.
export type Drizzle = BaseSQLiteDatabase<"sync" | "async", any>;

/** Adapter the read handlers expect — a SQLite-family Drizzle adapter. */
export type ReadAdapter = DatabaseAdapter<Drizzle>;

/**
 * Wide SQLite table type with the four system columns surfaced as `SQLiteColumn`s
 * and a string index for the dynamic field columns. Drizzle's `sqliteTable`
 * builder returns a `SQLiteTableWithColumns<…>`, which spreads the column map
 * onto the table at the type level — so `table.id`, `table.deletedAt`, etc.
 * type-check as `SQLiteColumn` directly. For dynamic columns (whose name comes
 * from a slug-resolved field), use the `column()` helper which performs the
 * one runtime existence check on our behalf.
 */
export type AnyTable = SQLiteTableWithColumns<{
  name: string;
  schema: string | undefined;
  dialect: "sqlite";
  columns: {
    id: SQLiteColumn;
    createdAt: SQLiteColumn;
    updatedAt: SQLiteColumn;
    deletedAt: SQLiteColumn;
    [k: string]: SQLiteColumn;
  };
}>;

/**
 * Look up a column by a dynamically-resolved name (cursor/order key, unique
 * field name). Existence is an invariant: validation upstream has already
 * checked that the field is part of the collection, so a missing column at
 * this point is a bug, not a user error.
 */
export function column(table: AnyTable, name: string): SQLiteColumn {
  const col = table[name];
  if (!col) {
    throw new Error(
      `column("${name}"): missing on table "${String(table)}" — upstream validation should have caught this`,
    );
  }
  return col;
}

/**
 * System columns every generated table carries. Domain fields come from the
 * matched collection's `fields` record via `InferDoc`.
 */
export interface SystemColumns {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Row shape derived from a single collection or singleton entry. Combines
 * the precise field types (via `@voila/content-schema`'s `InferDoc`) with
 * the system columns.
 *
 *   `RowFromEntry<typeof posts>` →
 *     `SystemColumns & InferDoc<typeof posts.fields>`
 */
export type RowFromEntry<E extends AnyCollection | AnySingleton> = SystemColumns &
  InferDoc<E["fields"] & Record<string, AnyFieldDef>>;

/**
 * Union of every possible row shape across a `Content`. This is what dynamic
 * read handlers return — at the URL routing boundary we know the slug is
 * runtime-string, so the row type collapses to the union of all declared
 * shapes. Callers narrow with a `'kind in row'` or slug check.
 */
export type RowsOf<C extends AnyContent> =
  | RowFromEntry<C["collections"][keyof C["collections"]]>
  | RowFromEntry<C["singletons"][keyof C["singletons"]]>;

/**
 * Backwards-compatible alias for the dynamic-slug row. With Option B's
 * typed `Content`, this is now a closed union of declared shapes rather
 * than `Record<string, unknown>`.
 */
export type Row<C extends AnyContent = AnyContent> = RowsOf<C>;

/**
 * Infer the row from a Drizzle `Table`. Equivalent to the table's
 * `$inferSelect`, exposed for handler code that already has the table in
 * hand and wants the row shape without re-deriving it from the collection.
 */
export type RowFromTable<T extends Table> = InferSelectModel<T>;

/**
 * Resolves the active session for a request, or `null` when there's none.
 * Implementations must fail soft (a malformed/expired cookie ⇒ `null`, not a
 * throw). Defined here (rather than in `../auth.ts`) so the context can
 * reference it without a circular import. See `requireApiSession`.
 */
export interface ApiSessionResolver {
  getSession(request: Request): Promise<unknown | null> | unknown | null;
}

/**
 * Handler context, parametric on the precise `Content` type so each handler
 * can derive precise row types and slug unions from the consumer's config.
 * Reads and writes share the base shape — both take a SQLite-family adapter and
 * an optional session resolver. Writes additionally carry the CSRF secret.
 */
export interface HandlerContext<C extends AnyContent = AnyContent> {
  readonly request: Request;
  readonly params: Record<string, string | undefined>;
  readonly content: C;
  readonly adapter: ReadAdapter;
  /**
   * Session resolver for API-level auth. When present, the handler enforces a
   * session (`401` if absent); when omitted, enforcement is skipped (used by
   * data-logic tests). The generated routes always inject one.
   */
  readonly auth?: ApiSessionResolver;
}

/** Context for the read handlers (`GET`). */
export type ReadHandlerContext<C extends AnyContent = AnyContent> = HandlerContext<C>;

/**
 * Context for the write handlers (`POST`/`PATCH`/`DELETE`/restore). Adds the
 * `csrfSecret` used to verify the signed double-submit token (the deployment's
 * `VOILA_AUTH_SECRET`, injected by the generated routes).
 */
export interface WriteHandlerContext<C extends AnyContent = AnyContent> extends HandlerContext<C> {
  readonly csrfSecret: string;
}

/**
 * Run a handler body that returns a `Result`, then map both branches to the
 * wire response. `E` is constrained to `ApiFailure` so each call site can
 * ship a narrower failure union without TypeScript inferring it to the first
 * error type it encounters.
 */
export async function respond<T>(
  body: () => Promise<Result<T, ApiFailure>>,
  toResponse: (value: T) => Response,
): Promise<Response> {
  try {
    const result = await body();
    return result.ok ? toResponse(result.value) : errorResponse(result.error);
  } catch (cause) {
    return errorResponse(internalFailure(cause));
  }
}
