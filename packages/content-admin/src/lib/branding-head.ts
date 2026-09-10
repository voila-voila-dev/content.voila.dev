// Document-`<head>` descriptors derived from admin branding. The host's root
// route owns its `<head>` (stylesheets, theme script), so rather than reach into
// it, branding contributes the document title, favicon and theme-token style
// block as plain meta/link/style objects to spread into the route's `head()`
// return — router-agnostic shapes TanStack Start renders as-is.
//
// The token block belongs here, rather than in a client effect, because the
// admin is server-rendered: tokens applied after hydration mean every load
// paints the default black-and-white admin and then flips to the brand. Sitting
// in `<head>` alongside the theme script, the brand is there in the first paint.

import { themeTokensCss } from "@voila/content-ui";
import type { AdminBranding, AdminBrandSource, ResolvedAdminTheme } from "../types";

/** A `head().meta` entry — either the document title or a named/charset tag. */
export type HeadMeta = Record<string, string>;
/** A `head().links` entry, e.g. `{ rel: "icon", href, type? }`. */
export type HeadLink = Record<string, string>;
/** A `head().styles` entry — an inline `<style>` with its CSS as `children`. */
export interface HeadStyle {
  readonly children: string;
}

export interface BrandingHeadOptions {
  /** Favicon used when `branding.favicon` is unset (e.g. a default app mark). */
  readonly defaultFavicon?: string;
  /** The admin's presentation options (`admin.theme`). */
  readonly theme?: ResolvedAdminTheme;
  /** Brand values read from content for this request — see `readBrandSource`. */
  readonly brand?: AdminBrandSource;
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
 * Build the `<head>` meta/links/styles a route should add for branding: the
 * document title (from `branding.title`), the favicon, and the theme-token
 * style block for the project's accent, radius and density.
 *
 * The favicon and the accent each resolve through the same chain — what
 * `defineAdmin` states explicitly wins, then what the editors set in content
 * (`options.brand`), then the host's default mark. Spread the result into a
 * route's `head()`:
 *
 * ```ts
 * head: ({ loaderData }) => {
 *   const brand = brandingHead(admin.branding, {
 *     defaultFavicon,
 *     theme: admin.theme,
 *     brand: loaderData?.brand,
 *   });
 *   return { meta: [...brand.meta], links: [...brand.links], styles: [...brand.styles] };
 * }
 * ```
 */
export function brandingHead(
  branding: AdminBranding,
  options: BrandingHeadOptions = {},
): { readonly meta: HeadMeta[]; readonly links: HeadLink[]; readonly styles: HeadStyle[] } {
  const meta: HeadMeta[] = branding.title ? [{ title: branding.title }] : [];

  // A logo the editors uploaded doubles as the favicon, so setting one image in
  // the settings singleton brands the tab as well as the sidebar.
  const favicon = branding.favicon ?? options.brand?.logo ?? options.defaultFavicon;
  const links: HeadLink[] = [];
  if (favicon) {
    const type = faviconType(favicon);
    links.push(type ? { rel: "icon", href: favicon, type } : { rel: "icon", href: favicon });
  }

  const theme = options.theme;
  const styles: HeadStyle[] = [];
  if (theme) {
    const css = themeTokensCss({
      accent: theme.accent ?? options.brand?.accent,
      radius: theme.radius,
      density: theme.density,
    });
    if (css !== "") styles.push({ children: css });
  }

  return { meta, links, styles };
}
