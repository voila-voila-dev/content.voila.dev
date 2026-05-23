/**
 * Drizzle table resolution for the read handlers. `schemaToTables` is pure but
 * non-trivial, so results are memoized per `Content` (and per dialect, since a
 * single config could be served by both SQLite and Postgres in tests).
 *
 * Collection/singleton storage is a record keyed by slug — lookups are O(1)
 * and the slug type narrows from `string` to `keyof Content['collections']`
 * (or `keyof Content['singletons']`) at the boundary.
 */

import {
  type DatabaseDialect,
  type GeneratedTables,
  schemaToTables,
} from "@voila/content-database";
import { err, ok, type Result } from "../shared/result.ts";
import type { AnyContent } from "../types.ts";
import { type UnknownCollectionError, unknownCollection } from "./errors.ts";
import type { AnyTable } from "./handlers/shared.ts";

const cache = new WeakMap<AnyContent, Map<DatabaseDialect, GeneratedTables>>();

export function tablesFor(content: AnyContent, dialect: DatabaseDialect): GeneratedTables {
  let byDialect = cache.get(content);
  if (!byDialect) {
    byDialect = new Map();
    cache.set(content, byDialect);
  }
  let tables = byDialect.get(dialect);
  if (!tables) {
    tables = schemaToTables(
      [...Object.values(content.collections), ...Object.values(content.singletons)],
      { dialect },
    );
    byDialect.set(dialect, tables);
  }
  return tables;
}

/**
 * Look up the Drizzle table for a slug. Concentrates the one cast we owe
 * Drizzle (the underlying `schemaToTables` registry is keyed by dynamic
 * slugs and so falls back to the wide config), so handlers can stay free of
 * `as` noise and the query builder gets a real `Table` to chew on.
 */
export function tableFor(content: AnyContent, dialect: DatabaseDialect, slug: string): AnyTable {
  return tablesFor(content, dialect)[slug] as AnyTable;
}

/**
 * Tagged result of resolving a `:collection` URL segment against the
 * registry. Lets handlers narrow on `kind` to pick the precise entry type
 * from a generic `Content<…>` without an extra membership probe.
 */
export type MatchedEntry<C extends AnyContent> =
  | {
      readonly kind: "collection";
      readonly slug: keyof C["collections"];
      readonly entry: C["collections"][keyof C["collections"]];
    }
  | {
      readonly kind: "singleton";
      readonly slug: keyof C["singletons"];
      readonly entry: C["singletons"][keyof C["singletons"]];
    };

/**
 * Resolve a `:collection` path segment against the registry. Collections and
 * singletons share a flat slug namespace, so a singleton is reachable through
 * the same `:collection` routes (its single row has `id === slug`).
 *
 * Returns a `MatchedEntry<C>` whose `slug` field is narrowed to the actual
 * key in `Content`'s map — callers can index back into `content.collections`
 * or `content.singletons` and get the precise entry type, not a union.
 */
export function requireCollection<C extends AnyContent>(
  content: C,
  slug: string | undefined,
): Result<MatchedEntry<C>, UnknownCollectionError> {
  if (slug && Object.hasOwn(content.collections, slug)) {
    return ok({
      kind: "collection",
      slug: slug as keyof C["collections"] & string,
      entry: content.collections[slug] as C["collections"][keyof C["collections"]],
    });
  }
  if (slug && Object.hasOwn(content.singletons, slug)) {
    return ok({
      kind: "singleton",
      slug: slug as keyof C["singletons"] & string,
      entry: content.singletons[slug] as C["singletons"][keyof C["singletons"]],
    });
  }
  return err(unknownCollection(slug ?? ""));
}
