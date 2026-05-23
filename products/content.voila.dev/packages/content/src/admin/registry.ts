import type { AnyCollection, AnyContent, AnySingleton } from "../types.ts";

/**
 * Runtime lookups against `Content`'s typed `collections` / `singletons`
 * maps. The maps are deliberately keyed by literal slug at the type level,
 * which means a plain `content.collections[someStringFromUrl]` won't
 * typecheck. These helpers absorb the one cast so generated route files
 * stay free of `as` noise.
 */
export function getCollection(content: AnyContent, slug: string): AnyCollection | undefined {
  return (content.collections as Record<string, AnyCollection | undefined>)[slug];
}

export function getSingleton(content: AnyContent, slug: string): AnySingleton | undefined {
  return (content.singletons as Record<string, AnySingleton | undefined>)[slug];
}
