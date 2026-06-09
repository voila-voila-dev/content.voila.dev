// nav — turns a `@voila/content` config into the admin navigation model. Pure
// and router-agnostic: it produces an `href` per collection/singleton (under a
// configurable `basePath`) and marks the active item from a `currentPath`, so
// the same model drives a plain `<a>`, a TanStack `<Link>`, or a Next link.
// `AppSidebar` renders it; keeping the derivation here keeps that component a
// thin view and lets the routing logic be unit-tested without the DOM.

import type { Collection, NormalizedConfig, Singleton } from "@voila/content";
import { humanize } from "./humanize";

export interface NavItem {
  readonly slug: string;
  readonly label: string;
  readonly href: string;
  readonly isActive: boolean;
  readonly kind: "collection" | "singleton";
}

export interface NavGroups {
  readonly collections: readonly NavItem[];
  readonly singletons: readonly NavItem[];
}

export interface BuildNavOptions {
  /** URL prefix the admin is mounted under. Defaults to `/admin`. */
  readonly basePath?: string;
  /** The current location's pathname, used to mark the active item. */
  readonly currentPath?: string;
}

/** Drop a trailing slash so `${base}/${slug}` never doubles up. */
function normalizeBase(basePath: string): string {
  return basePath.length > 1 && basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

/** Active when the path is the item itself or sits beneath it (a detail page
 *  like `/admin/posts/123` keeps `posts` highlighted). */
function isActive(href: string, currentPath?: string): boolean {
  if (!currentPath) return false;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function toItem(
  kind: NavItem["kind"],
  slug: string,
  label: string | undefined,
  base: string,
  currentPath?: string,
): NavItem {
  const href = `${base}/${slug}`;
  return {
    slug,
    label: label ?? humanize(slug),
    href,
    isActive: isActive(href, currentPath),
    kind,
  };
}

/** Build the sidebar nav model from a normalized config, in declaration order. */
export function buildNav(config: NormalizedConfig, options: BuildNavOptions = {}): NavGroups {
  const base = normalizeBase(options.basePath ?? "/admin");
  const { currentPath } = options;
  const collections = (Object.values(config.collections) as Collection[]).map((c) =>
    toItem("collection", c.slug, c.label, base, currentPath),
  );
  const singletons = (Object.values(config.singletons) as Singleton[]).map((s) =>
    toItem("singleton", s.slug, s.label, base, currentPath),
  );
  return { collections, singletons };
}
