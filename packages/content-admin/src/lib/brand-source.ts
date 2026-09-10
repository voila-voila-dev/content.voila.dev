// Reading the brand out of the project's own content.
//
// `defineAdmin`'s `theme.accentFrom` / `theme.logoFrom` name a field in a
// singleton — `"settings.primaryColor"`, `"settings.logo"` — rather than
// hard-coding a colour in config. That's the whole point of the feature: the
// editor who picks the brand colour in the admin is the person who restyles the
// admin, with no deploy.
//
// This module is the pure half: given documents someone else loaded, pick the
// two values out. The loading half is `resolveBrandSource` in
// `@voila/content-admin/server` (a `Database`) or whatever a host already has
// (the demo reads its singleton through its sandbox Durable Object).

import type { AdminBrandSource, ResolvedAdminTheme } from "../types";

/** Split `"settings.primaryColor"` into its singleton slug and field name. A
 *  path with no dot names no field and resolves to nothing. */
function splitPath(path: string): { readonly slug: string; readonly field: string } | null {
  const dot = path.indexOf(".");
  if (dot <= 0 || dot === path.length - 1) return null;
  return { slug: path.slice(0, dot), field: path.slice(dot + 1) };
}

/** The singleton slugs a theme needs loaded — what a host should fetch before
 *  calling {@link readBrandSource}. Empty when the theme reads no content. */
export function brandSingletons(theme: ResolvedAdminTheme): string[] {
  const slugs = new Set<string>();
  for (const path of [theme.accentFrom, theme.logoFrom]) {
    const parsed = path === undefined ? null : splitPath(path);
    if (parsed !== null) slugs.add(parsed.slug);
  }
  return [...slugs];
}

/** Read one field off a loaded document, if the document looks like a document. */
function fieldValue(docs: Readonly<Record<string, unknown>>, path: string): unknown {
  const parsed = splitPath(path);
  if (parsed === null) return undefined;
  const doc = docs[parsed.slug];
  if (doc === null || typeof doc !== "object") return undefined;
  return (doc as Record<string, unknown>)[parsed.field];
}

/** A `media` field stores a `MediaValue` (`{ url, mime, … }`); a plain string
 *  field just stores the URL. Accept both so `logoFrom` can point at either. */
function mediaSrc(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (value === null || typeof value !== "object") return undefined;
  const url = (value as { url?: unknown }).url;
  return typeof url === "string" && url.trim() !== "" ? url : undefined;
}

/**
 * Pick the accent + logo out of already-loaded singleton documents, keyed by
 * slug (`{ settings: doc }`).
 *
 * A literal `theme.accent` wins over `accentFrom`: config is the deliberate
 * choice, content is the delegated one. Anything missing, empty, or of an
 * unexpected shape is simply absent from the result — a half-filled settings
 * page must leave the default theme standing, never break the admin.
 */
export function readBrandSource(
  theme: ResolvedAdminTheme,
  docs: Readonly<Record<string, unknown>>,
): AdminBrandSource {
  const fromContent =
    theme.accentFrom === undefined ? undefined : fieldValue(docs, theme.accentFrom);
  const accent =
    theme.accent ??
    (typeof fromContent === "string" && fromContent.trim() !== "" ? fromContent : undefined);
  const logo =
    theme.logoFrom === undefined ? undefined : mediaSrc(fieldValue(docs, theme.logoFrom));

  const source: { accent?: string; logo?: string } = {};
  if (accent !== undefined) source.accent = accent;
  if (logo !== undefined) source.logo = logo;
  return source;
}
