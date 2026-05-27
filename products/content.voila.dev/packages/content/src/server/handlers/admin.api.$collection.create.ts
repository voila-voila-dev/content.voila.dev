import { err, ok } from "../../shared/result.ts";
import type { AnyContent } from "../../types.ts";
import { requireApiSession } from "../auth.ts";
import { verifyCsrf } from "../csrf.ts";
import { conflict } from "../errors.ts";
import { requireCollection, tableFor } from "../tables.ts";
import { validateWrite } from "../validate.ts";
import { isUniqueViolation, readJsonObject, uniqueViolationField } from "../write.ts";
import { type RowsOf, respond, type WriteHandlerContext } from "./shared.ts";

/** `POST /admin/api/:collection` — create a record. Returns `201 { data }`. */
export function handleCreate<C extends AnyContent>(ctx: WriteHandlerContext<C>): Promise<Response> {
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

      // Validation drops everything that isn't a declared field, so system
      // columns (id, timestamps) can't be injected — the DB defaults fill them.
      const validated = await validateWrite(entry, body.value);
      if (!validated.ok) return validated;

      const table = tableFor(ctx.content, ctx.adapter.dialect, entry.slug);
      const db = ctx.adapter.drizzle;

      try {
        const row = (await db.insert(table).values(validated.value).returning().get()) as RowsOf<C>;
        return ok(row);
      } catch (cause) {
        if (isUniqueViolation(cause)) {
          return err(conflict(entry.slug, uniqueViolationField(cause, entry.fields)));
        }
        throw cause;
      }
    },
    (row) => Response.json({ data: row }, { status: 201 }),
  );
}
