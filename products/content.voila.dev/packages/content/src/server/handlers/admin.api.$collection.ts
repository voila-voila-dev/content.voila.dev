import { and, asc, desc, eq, gt, isNull, lt, or, type SQL } from "drizzle-orm";
import { ok } from "../../shared/result.ts";
import type { AnyContent } from "../../types.ts";
import { cursorValueOf, encodeCursor, parseListQuery, reviveCursorValue } from "../query.ts";
import { requireCollection, tableFor } from "../tables.ts";
import { column, type ReadHandlerContext, type RowsOf, respond } from "./shared.ts";

/** `GET /admin/api/:collection` — cursor-paginated list. */
export function handleList<C extends AnyContent>(ctx: ReadHandlerContext<C>): Promise<Response> {
  return respond(
    async () => {
      const matched = requireCollection(ctx.content, ctx.params.collection);
      if (!matched.ok) return matched;
      const { entry } = matched.value;

      const query = parseListQuery(new URL(ctx.request.url), entry);
      if (!query.ok) return query;

      const table = tableFor(ctx.content, ctx.adapter.dialect, entry.slug);
      const db = ctx.adapter.drizzle;

      const orderCol = column(table, query.value.orderKey);
      const idCol = table.id;
      const dir = query.value.direction === "asc" ? asc : desc;
      const after = query.value.direction === "asc" ? gt : lt;

      const conditions: Array<SQL | undefined> = [isNull(table.deletedAt)];
      if (query.value.cursor) {
        const boundary = reviveCursorValue(entry, query.value.orderKey, query.value.cursor.c);
        // Keyset: rows strictly past (orderValue, id) in the active sort order.
        conditions.push(
          or(
            after(orderCol, boundary),
            and(eq(orderCol, boundary), after(idCol, query.value.cursor.id)),
          ),
        );
      }

      const rows = (await db
        .select()
        .from(table)
        .where(and(...conditions))
        .orderBy(dir(orderCol), dir(idCol))
        .limit(query.value.limit + 1)
        .all()) as RowsOf<C>[];

      // Fetch one extra row to detect a next page without a separate count query.
      let nextCursor: string | null = null;
      if (rows.length > query.value.limit) {
        const last = rows[query.value.limit - 1] as RowsOf<C>;
        rows.length = query.value.limit;
        nextCursor = encodeCursor({
          c: cursorValueOf(query.value.orderKey, last),
          id: last.id,
        });
      }

      return ok({ rows, nextCursor });
    },
    ({ rows, nextCursor }) => Response.json({ data: rows, nextCursor }),
  );
}
