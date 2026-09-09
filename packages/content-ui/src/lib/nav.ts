// nav — turns a `@voila/content` config into the admin navigation model. Pure
// and router-agnostic: it produces an `href` per collection/singleton (under a
// configurable `basePath`) and marks the active item from a `currentPath`, so
// the same model drives a plain `<a>`, a TanStack `<Link>`, or a Next link.
// `AppSidebar` renders it; keeping the derivation here keeps that component a
// thin view and lets the routing logic be unit-tested without the DOM.
//
// Items carry a Phosphor icon name (the entity's `icon`, else a per-kind
// default) and are bucketed into labelled groups: the entity's own `group`
// label when set, else "Collections" / "Content". Exactly one item is active —
// the one whose href is the LONGEST prefix of the current path — so a nested
// route never lights up two entries (e.g. `/` and `/posts`).

import type { Collection, NormalizedConfig, Singleton } from "@voila/content";
import { humanize } from "./humanize";

export interface NavItem {
  readonly slug: string;
  readonly label: string;
  readonly href: string;
  readonly isActive: boolean;
  readonly kind: "collection" | "singleton";
  /** Phosphor icon name (`"Article"`); the sidebar resolves it, unknown → default. */
  readonly icon?: string;
}

export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

export interface NavGroups {
  readonly collections: readonly NavItem[];
  readonly singletons: readonly NavItem[];
  /** The same items bucketed by their `group` label, in first-seen order. */
  readonly groups: readonly NavGroup[];
}

export interface BuildNavOptions {
  /** URL prefix the admin is mounted under. Defaults to `/admin`. */
  readonly basePath?: string;
  /** The current location's pathname, used to mark the active item. */
  readonly currentPath?: string;
}

/** Default icons per entity kind, when the config declares none. */
export const DEFAULT_NAV_ICONS = {
  collection: "StackSimple",
  singleton: "SlidersHorizontal",
  home: "House",
} as const;

export const DEFAULT_GROUP_LABELS = {
  collection: "Collections",
  singleton: "Content",
} as const;

/** Drop a trailing slash so `${base}/${slug}` never doubles up. */
export function normalizeBase(basePath: string): string {
  return basePath.length > 1 && basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

/** The dashboard href for a base path: the base itself, or `/` for a root mount. */
export function homeHref(basePath: string | undefined): string {
  const base = normalizeBase(basePath ?? "/admin");
  return base === "" ? "/" : base;
}

/** Active when the path is the item itself or sits beneath it (a detail page
 *  like `/admin/posts/123` keeps `posts` highlighted). The root `/` only ever
 *  matches itself — every path sits "beneath" it. */
export function isNavActive(href: string, currentPath?: string): boolean {
  if (!currentPath) return false;
  if (currentPath === href) return true;
  if (href === "/") return false;
  return currentPath.startsWith(`${href}/`);
}

/**
 * Among items whose href matches, keep only the longest-prefix one active. A
 * pure list transform so hosts can apply it over their own extra items too.
 */
export function markLongestActive<T extends { readonly href: string; readonly isActive: boolean }>(
  items: readonly T[],
): T[] {
  const winner = items
    .filter((item) => item.isActive)
    .reduce<T | undefined>(
      (best, item) => (best === undefined || item.href.length > best.href.length ? item : best),
      undefined,
    );
  return items.map((item) =>
    item.isActive && item !== winner ? { ...item, isActive: false } : item,
  );
}

function toItem(
  kind: NavItem["kind"],
  entity: { slug: string; label?: string; icon?: string },
  base: string,
  currentPath?: string,
): NavItem {
  const href = `${base}/${entity.slug}`;
  return {
    slug: entity.slug,
    label: entity.label ?? humanize(entity.slug),
    href,
    isActive: isNavActive(href, currentPath),
    kind,
    icon: entity.icon ?? DEFAULT_NAV_ICONS[kind],
  };
}

/** Bucket items into labelled groups, in first-seen order. */
function groupItems(entries: ReadonlyArray<{ item: NavItem; group: string }>): NavGroup[] {
  const groups = new Map<string, NavItem[]>();
  for (const { item, group } of entries) {
    const list = groups.get(group);
    if (list) list.push(item);
    else groups.set(group, [item]);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

/** Build the sidebar nav model from a normalized config, in declaration order. */
export function buildNav(config: NormalizedConfig, options: BuildNavOptions = {}): NavGroups {
  const base = normalizeBase(options.basePath ?? "/admin");
  const { currentPath } = options;
  const collectionDefs = Object.values(config.collections) as Collection[];
  const singletonDefs = Object.values(config.singletons) as Singleton[];

  // Longest-prefix dedupe runs over the whole set before bucketing, so a
  // singleton and a collection can never both be active.
  const all = markLongestActive([
    ...collectionDefs.map((c) => ({
      item: toItem("collection", c, base, currentPath),
      group: c.group ?? DEFAULT_GROUP_LABELS.collection,
      href: `${base}/${c.slug}`,
      isActive: isNavActive(`${base}/${c.slug}`, currentPath),
    })),
    ...singletonDefs.map((s) => ({
      item: toItem("singleton", s, base, currentPath),
      group: s.group ?? DEFAULT_GROUP_LABELS.singleton,
      href: `${base}/${s.slug}`,
      isActive: isNavActive(`${base}/${s.slug}`, currentPath),
    })),
  ]).map((entry) => ({ item: { ...entry.item, isActive: entry.isActive }, group: entry.group }));

  const collections = all.filter((e) => e.item.kind === "collection").map((e) => e.item);
  const singletons = all.filter((e) => e.item.kind === "singleton").map((e) => e.item);
  return { collections, singletons, groups: groupItems(all) };
}
