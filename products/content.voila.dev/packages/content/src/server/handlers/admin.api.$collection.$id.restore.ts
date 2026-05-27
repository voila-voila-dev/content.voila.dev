import { and, eq, isNotNull } from "drizzle-orm";
import { err, ok } from "../../shared/result.ts";
import type { AnyContent } from "../../types.ts";
import { requireApiSession } from "../auth.ts";
import { verifyCsrf } from "../csrf.ts";
import { notFound } from "../errors.ts";
import { requireCollection, tableFor } from "../tables.ts";
import { type RowsOf, respond, type WriteHandlerContext } from "./shared.ts";

/**
 * `POST /admin/api/:collection/:id/restore` — clear `deletedAt` on a
 * soft-deleted row. Scoped to deleted rows, so restoring a live or absent row
 * reads as not-found. Returns the restored row as `200 { data }`.
 */
export function handleRestore<C extends AnyContent>(
  ctx: WriteHandlerContext<C>,
): Promise<Response> {
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
      const table = tableFor(ctx.content, ctx.adapter.dialect, entry.slug);
      const db = ctx.adapter.drizzle;

      const row = (await db
        .update(table)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(and(eq(table.id, id), isNotNull(table.deletedAt)))
        .returning()
        .get()) as RowsOf<C> | undefined;

      if (!row) return err(notFound(entry.slug));
      return ok(row);
    },
    (row) => Response.json({ data: row }),
  );
}
