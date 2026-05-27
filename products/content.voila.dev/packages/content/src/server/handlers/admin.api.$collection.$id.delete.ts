import { and, eq, isNull } from "drizzle-orm";
import { err, ok } from "../../shared/result.ts";
import type { AnyContent } from "../../types.ts";
import { requireApiSession } from "../auth.ts";
import { verifyCsrf } from "../csrf.ts";
import { notFound } from "../errors.ts";
import { requireCollection, tableFor } from "../tables.ts";
import { type RowsOf, respond, type WriteHandlerContext } from "./shared.ts";

/**
 * `DELETE /admin/api/:collection/:id` — soft delete by default (stamps
 * `deletedAt`). Pass `?hard=true` to purge the row permanently. A row that's
 * already gone (soft-deleted, or absent) reads as not-found. Returns the
 * affected row as `200 { data }`.
 */
export function handleDelete<C extends AnyContent>(ctx: WriteHandlerContext<C>): Promise<Response> {
  return respond(
    async () => {
      const session = await requireApiSession(ctx);
      if (!session.ok) return session;

      const guard = await verifyCsrf(ctx.request, ctx.csrfSecret);
      if (!guard.ok) return guard;

      const matched = requireCollection(ctx.content, ctx.params.collection);
      if (!matched.ok) return matched;
      const { entry } = matched.value;

      const id = ctx.params.id ?? "";
      const hard = new URL(ctx.request.url).searchParams.get("hard") === "true";
      const table = tableFor(ctx.content, ctx.adapter.dialect, entry.slug);
      const db = ctx.adapter.drizzle;

      const row = hard
        ? ((await db.delete(table).where(eq(table.id, id)).returning().get()) as
            | RowsOf<C>
            | undefined)
        : ((await db
            .update(table)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(table.id, id), isNull(table.deletedAt)))
            .returning()
            .get()) as RowsOf<C> | undefined);

      if (!row) return err(notFound(entry.slug));
      return ok(row);
    },
    (row) => Response.json({ data: row }),
  );
}
