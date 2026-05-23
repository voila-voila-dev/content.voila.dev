import type { AnyFieldDef } from "@voila/content-schema";
import { and, eq, isNull } from "drizzle-orm";
import { err, ok } from "../../shared/result.ts";
import type { AnyContent } from "../../types.ts";
import { fieldNotUnique, notFound, unknownField } from "../errors.ts";
import { coerceFieldValue } from "../query.ts";
import { requireCollection, tableFor } from "../tables.ts";
import { column, type ReadHandlerContext, type RowsOf, respond } from "./shared.ts";

/** `GET /admin/api/:collection/by/:field/:value` — find by a unique field. */
export function handleFindByField<C extends AnyContent>(
  ctx: ReadHandlerContext<C>,
): Promise<Response> {
  return respond(
    async () => {
      const matched = requireCollection(ctx.content, ctx.params.collection);
      if (!matched.ok) return matched;
      const { entry } = matched.value;

      const fieldName = ctx.params.field ?? "";
      const rawValue = ctx.params.value ?? "";

      const field = entry.fields[fieldName] as AnyFieldDef | undefined;
      if (!field) return err(unknownField(entry.slug, fieldName));
      if (field.unique !== true) {
        return err(fieldNotUnique(entry.slug, fieldName));
      }

      const value = coerceFieldValue(field, rawValue);
      if (!value.ok) return value;

      const table = tableFor(ctx.content, ctx.adapter.dialect, entry.slug);
      const db = ctx.adapter.drizzle;

      const row = (await db
        .select()
        .from(table)
        .where(and(eq(column(table, fieldName), value.value), isNull(table.deletedAt)))
        .get()) as RowsOf<C> | undefined;

      if (!row) return err(notFound(entry.slug));
      return ok(row);
    },
    (row) => Response.json({ data: row }),
  );
}
