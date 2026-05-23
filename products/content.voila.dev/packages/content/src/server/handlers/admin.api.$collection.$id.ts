import { and, eq, isNull } from "drizzle-orm";
import { err, ok } from "../../shared/result.ts";
import type { AnyContent } from "../../types.ts";
import { notFound } from "../errors.ts";
import { requireCollection, tableFor } from "../tables.ts";
import { type ReadHandlerContext, type RowsOf, respond } from "./shared.ts";

/** `GET /admin/api/:collection/:id` — find by primary key. */
export function handleFindById<C extends AnyContent>(
  ctx: ReadHandlerContext<C>,
): Promise<Response> {
  return respond(
    async () => {
      const matched = requireCollection(ctx.content, ctx.params.collection);
      if (!matched.ok) return matched;
      const { entry } = matched.value;

      const id = ctx.params.id ?? "";
      const table = tableFor(ctx.content, ctx.adapter.dialect, entry.slug);
      const db = ctx.adapter.drizzle;

      const row = (await db
        .select()
        .from(table)
        .where(and(eq(table.id, id), isNull(table.deletedAt)))
        .get()) as RowsOf<C> | undefined;

      if (!row) return err(notFound(entry.slug));
      return ok(row);
    },
    (row) => Response.json({ data: row }),
  );
}
