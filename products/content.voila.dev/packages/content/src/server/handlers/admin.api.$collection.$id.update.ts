import { and, eq, isNull } from "drizzle-orm";
import { err, ok } from "../../shared/result.ts";
import type { AnyContent } from "../../types.ts";
import { requireApiSession } from "../auth.ts";
import { verifyCsrf } from "../csrf.ts";
import { badRequest, conflict, notFound } from "../errors.ts";
import { requireCollection, tableFor } from "../tables.ts";
import { validateWritePartial } from "../validate.ts";
import { isUniqueViolation, readJsonObject, uniqueViolationField } from "../write.ts";
import { type RowsOf, respond, type WriteHandlerContext } from "./shared.ts";

/** `PATCH /admin/api/:collection/:id` — partial update. Returns `200 { data }`. */
export function handleUpdate<C extends AnyContent>(ctx: WriteHandlerContext<C>): Promise<Response> {
  return respond(
    async () => {
      const session = await requireApiSession(ctx);
      if (!session.ok) return session;

      const guard = await verifyCsrf(ctx.request, ctx.csrfSecret);
      if (!guard.ok) return guard;

      const matched = requireCollection(ctx.content, ctx.params.collection);
      if (!matched.ok) return matched;
      const { entry } = matched.value;

      const body = await readJsonObject(ctx.request);
      if (!body.ok) return body;

      const validated = await validateWritePartial(entry, body.value);
      if (!validated.ok) return validated;
      if (Object.keys(validated.value).length === 0) {
        return err(badRequest({ reason: "no updatable fields in patch" }));
      }

      const id = ctx.params.id ?? "";
      const table = tableFor(ctx.content, ctx.adapter.dialect, entry.slug);
      const db = ctx.adapter.drizzle;

      try {
        // `updatedAt` is a DB default on insert only; bump it explicitly here.
        // Scope to live rows so a soft-deleted record reads as not-found.
        const row = (await db
          .update(table)
          .set({ ...validated.value, updatedAt: new Date() })
          .where(and(eq(table.id, id), isNull(table.deletedAt)))
          .returning()
          .get()) as RowsOf<C> | undefined;

        if (!row) return err(notFound(entry.slug));
        return ok(row);
      } catch (cause) {
        if (isUniqueViolation(cause)) {
          return err(conflict(entry.slug, uniqueViolationField(cause, entry.fields)));
        }
        throw cause;
      }
    },
    (row) => Response.json({ data: row }),
  );
}
