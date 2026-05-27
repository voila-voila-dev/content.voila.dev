import type { AnyFieldDef } from "@voila/content-schema";
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  real,
  type SQLiteTableWithColumns,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import {
  type CollectionLike,
  SQLITE_UUID_DEFAULT,
  singletonCheckSql,
  toColumnName,
  unknownKind,
  withMods,
} from "./common.ts";

// biome-ignore lint/suspicious/noExplicitAny: drizzle's generated table types are wide; consumers narrow via the collection slug.
type SqliteTable = SQLiteTableWithColumns<any>;

/** Build a Drizzle sqlite table for one collection or singleton. */
export function buildSqliteTable(c: CollectionLike): SqliteTable {
  const cols: Record<string, unknown> = {
    id: text("id").primaryKey().default(SQLITE_UUID_DEFAULT),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  };
  for (const [name, field] of Object.entries(c.fields)) {
    cols[name] = sqliteColumnFor(name, field);
  }
  // biome-ignore lint/suspicious/noExplicitAny: drizzle's column-record signature uses a tight generic that doesn't survive `Record<string, unknown>`.
  return sqliteTable(c.slug, cols as any, (t) =>
    c.kind === "singleton" ? [check(`${c.slug}_singleton`, singletonCheckSql(t.id, c.slug))] : [],
  );
}

function sqliteColumnFor(name: string, field: AnyFieldDef) {
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
      return withMods(integer(col, { mode: "boolean" }), field);
    case "date":
      return withMods(text(col), field);
    case "datetime":
      return withMods(integer(col, { mode: "timestamp_ms" }), field);
    case "select":
      return withMods(text(col), field);
    case "slug":
      return withMods(text(col), field);
    case "json":
      return withMods(text(col, { mode: "json" }), field);
    default:
      throw unknownKind(field.kind, name);
  }
}
