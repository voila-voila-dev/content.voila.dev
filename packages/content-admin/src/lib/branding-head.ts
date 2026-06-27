// Document-`<head>` descriptors derived from admin branding. The host's root
// route owns its `<head>` (stylesheets, theme script), so rather than reach into
// it, branding contributes the document title and favicon as plain meta/link
// objects to spread into the route's `head()` return — router-agnostic shapes
// TanStack Start renders as-is.

import type { AdminBranding } from "../types";

/** A `head().meta` entry — either the document title or a named/charset tag. */
export type HeadMeta = Record<string, string>;
/** A `head().links` entry, e.g. `{ rel: "icon", href, type? }`. */
export type HeadLink = Record<string, string>;

export interface BrandingHeadOptions {
  /** Favicon used when `branding.favicon` is unset (e.g. a default app mark). */
  readonly defaultFavicon?: string;
}

/** Best-effort favicon `type` hint from the href, so SVG/PNG/ICO marks declare
 *  the right MIME. Returns `undefined` for unknown shapes — the `type` attribute
 *  is only a hint, so the browser still loads the icon without it. */
function faviconType(href: string): string | undefined {
  if (href.startsWith("data:image/svg") || href.endsWith(".svg")) return "image/svg+xml";
  if (href.startsWith("data:image/png") || href.endsWith(".png")) return "image/png";
  if (href.endsWith(".ico")) return "image/x-icon";
  return undefined;
}

/**
 * Build the `<head>` meta/links a route should add for branding: the document
 * title (from `branding.title`) and the favicon (`branding.favicon`, falling
 * back to `options.defaultFavicon`). Spread the result into a route's `head()`:
 *
 * ```ts
 * head: () => {
 *   const brand = brandingHead(admin.branding, { defaultFavicon });
 *   return { meta: [{ charSet: "utf-8" }, ...brand.meta], links: [...brand.links] };
 * }
 * ```
 */
export function brandingHead(
  branding: AdminBranding,
  options: BrandingHeadOptions = {},
): { readonly meta: HeadMeta[]; readonly links: HeadLink[] } {
  const meta: HeadMeta[] = branding.title ? [{ title: branding.title }] : [];

  const favicon = branding.favicon ?? options.defaultFavicon;
  const links: HeadLink[] = [];
  if (favicon) {
    const type = faviconType(favicon);
    links.push(type ? { rel: "icon", href: favicon, type } : { rel: "icon", href: favicon });
  }

  return { meta, links };
}
