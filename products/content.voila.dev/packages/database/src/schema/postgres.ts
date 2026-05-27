import type { AnyFieldDef } from "@voila/content-schema";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  type PgTableWithColumns,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import {
  type CollectionLike,
  POSTGRES_UUID_DEFAULT,
  singletonCheckSql,
  toColumnName,
  unknownKind,
  withMods,
} from "./common.ts";

// biome-ignore lint/suspicious/noExplicitAny: drizzle's generated table types are wide; consumers narrow via the collection slug.
type PgTable = PgTableWithColumns<any>;

/** Build a Drizzle postgres table for one collection or singleton. */
export function buildPostgresTable(c: CollectionLike): PgTable {
  const cols: Record<string, unknown> = {
    id: text("id").primaryKey().default(POSTGRES_UUID_DEFAULT),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  };
  for (const [name, field] of Object.entries(c.fields)) {
    cols[name] = pgColumnFor(name, field);
  }
  // biome-ignore lint/suspicious/noExplicitAny: drizzle's column-record signature uses a tight generic that doesn't survive `Record<string, unknown>`.
  return pgTable(c.slug, cols as any, (t) =>
    c.kind === "singleton" ? [check(`${c.slug}_singleton`, singletonCheckSql(t.id, c.slug))] : [],
  );
}

function pgColumnFor(name: string, field: AnyFieldDef) {
  const col = toColumnName(name);
  switch (field.kind) {
    case "string":
      return withMods(text(col), field);
    case "number":
      return withMods(
        (field as { integer?: boolean }).integer === true ? integer(col) : real(col),
        field,
      );
    case "boolean":
      return withMods(boolean(col), field);
    case "date":
      return withMods(date(col, { mode: "string" }), field);
    case "datetime":
      return withMods(timestamp(col, { withTimezone: true, mode: "date" }), field);
    case "select":
      return withMods(text(col), field);
    case "slug":
      return withMods(text(col), field);
    case "json":
      return withMods(jsonb(col), field);
    default:
      throw unknownKind(field.kind, name);
  }
}
