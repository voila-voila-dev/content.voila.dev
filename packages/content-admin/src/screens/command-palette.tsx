// CommandPalette — the ⌘K entry point: jump to any collection / singleton /
// custom screen, start a "New …" in one keystroke, run an admin action, and
// find RECORDS as you type. Opened from the sidebar's search row or the ⌘K
// shortcut; owned by the shell layout so it's available on every screen.
//
// Record lookup works on every collection, not just indexed ones. A collection
// with `search` enabled is queried server-side (`client.<slug>.search`); one
// without is matched against its most recently updated rows by title. That
// second path is the important one — without it, a project that never opted
// into full-text search had a ⌘K that could not find a single record, which is
// the one thing people reach for ⌘K to do.

import { MagnifyingGlassIcon, MoonIcon, PlusIcon, SunIcon } from "@phosphor-icons/react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import type { Doc } from "@voila/content-ui";
import {
  buildNav,
  collectionOperations,
  DEFAULT_NAV_ICONS,
  documentTitle,
  homeHref,
  NamedIcon,
  resolvedTheme,
  searchEnabled,
  setTheme,
  singularLabel,
  useI18n,
} from "@voila/content-ui";
import { Command } from "@voila.dev/ui/command";
import { type ReactNode, useEffect, useState } from "react";
import { useAdmin } from "../context";
import { type AnyListParams, collectionClient } from "../lib/client-access";
import { buildExtraGroups } from "../nav";

/** Rows shown per collection in the palette. */
const PALETTE_RESULTS = 5;
/** Recent rows scanned for a title match on a collection without an index. */
const RECENT_SCAN = 50;
/** Characters before record lookup starts, so one keystroke doesn't query. */
const MIN_TERM = 2;

export interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Debounce a value: the returned value trails `value` by `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const i18n = useI18n();
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim(), 200);

  const nav = buildNav(admin.config, { basePath: admin.basePath, groups: admin.nav?.groups });
  const extra = buildExtraGroups({
    screens: admin.screens,
    nav: admin.nav,
    basePath: admin.basePath,
  });

  const collections = Object.values(admin.config.collections) as Collection[];
  // "New …" only for collections that accept a create (`operations.create`).
  const creatable = nav.collections.filter((item) => {
    const collection = admin.config.collections[item.slug] as Collection | undefined;
    return collection !== undefined && collectionOperations(collection).create;
  });
  // Indexed collections search server-side per term; the rest are matched
  // against one cached page of recent rows, so ⌘K finds records either way.
  const results = useQueries({
    queries: collections.map((collection) => {
      const indexed = searchEnabled(collection.search);
      const api = collectionClient(admin.client, collection.slug);
      return indexed
        ? {
            queryKey: ["palette", collection.slug, term],
            queryFn: () => api.search(term, { limit: PALETTE_RESULTS }),
            enabled: open && term.length >= MIN_TERM,
            staleTime: 10_000,
          }
        : {
            queryKey: ["palette", collection.slug, "recent"],
            queryFn: () =>
              api.list({
                limit: RECENT_SCAN,
                orderBy: "updatedAt",
                order: "desc",
              } as AnyListParams),
            enabled: open,
            staleTime: 30_000,
          };
    }),
  });

  /** The rows to show under a collection, already narrowed to the term. */
  function matchesFor(collection: Collection, index: number): ReadonlyArray<Doc> {
    const page = results[index]?.data;
    if (!page) return [];
    if (term.length < MIN_TERM) return [];
    if (searchEnabled(collection.search)) return page.data;
    const needle = term.toLowerCase();
    return page.data
      .filter((row) => (documentTitle(collection, row, i18n) ?? "").toLowerCase().includes(needle))
      .slice(0, PALETTE_RESULTS);
  }

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    void navigate({ href });
  }

  // Reset the query when the palette closes so it opens fresh next time.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search and jump"
      description="Jump to a collection, create a record, or search documents."
    >
      {/* `Command.Dialog` is only the dialog chrome — the cmdk store lives on `Command.Root`. */}
      <Command.Root>
        <Command.Input
          placeholder="Search or jump to…"
          value={query}
          onValueChange={setQuery}
          aria-label="Search or jump to"
        />
        <Command.List>
          <Command.Empty>No results.</Command.Empty>

          {term.length >= MIN_TERM
            ? collections.map((collection, index) => {
                const matches = matchesFor(collection, index);
                if (matches.length === 0) return null;
                return (
                  <Command.Group
                    key={`search-${collection.slug}`}
                    heading={collection.label ?? collection.slug}
                  >
                    {matches.map((row) => {
                      const id = String(row.id);
                      return (
                        <Command.Item
                          key={`${collection.slug}-${id}`}
                          value={`${collection.slug} ${id} ${documentTitle(collection, row, i18n) ?? ""}`}
                          onSelect={() => go(`${admin.basePath}/${collection.slug}/${id}`)}
                        >
                          <MagnifyingGlassIcon aria-hidden />
                          <span className="truncate">
                            {documentTitle(collection, row, i18n) ?? id}
                          </span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                );
              })
            : null}

          <Command.Group heading="Go to">
            <Command.Item
              value="overview home dashboard"
              onSelect={() => go(homeHref(admin.basePath))}
            >
              <NamedIcon name={DEFAULT_NAV_ICONS.home} />
              Overview
            </Command.Item>
            {[...nav.collections, ...nav.singletons].map((item) => (
              <Command.Item
                key={item.slug}
                value={`go ${item.label} ${item.slug}`}
                onSelect={() => go(item.href)}
              >
                <NamedIcon name={item.icon} fallback={DEFAULT_NAV_ICONS[item.kind]} />
                {item.label}
              </Command.Item>
            ))}
            {extra.flatMap((group) =>
              group.items.map((item) => (
                <Command.Item
                  key={`${group.label}-${item.slug}`}
                  value={`go ${item.label}`}
                  onSelect={() => go(item.href)}
                >
                  <NamedIcon name={item.icon} fallback="ArrowSquareOut" />
                  {item.label}
                </Command.Item>
              )),
            )}
          </Command.Group>

          <Command.Group heading="Actions">
            <Command.Item
              value="theme dark light appearance toggle"
              onSelect={() => {
                setTheme(resolvedTheme() === "dark" ? "light" : "dark");
                onOpenChange(false);
              }}
            >
              <SunIcon aria-hidden className="dark:hidden" />
              <MoonIcon aria-hidden className="hidden dark:block" />
              Toggle theme
            </Command.Item>
          </Command.Group>

          {creatable.length > 0 ? (
            <Command.Group heading="Create">
              {creatable.map((item) => {
                const collection = admin.config.collections[item.slug] as Collection | undefined;
                const singular = collection ? singularLabel(collection) : item.label;
                return (
                  <Command.Item
                    key={`new-${item.slug}`}
                    value={`new create ${singular} ${item.label}`}
                    onSelect={() => go(`${item.href}/new`)}
                  >
                    <PlusIcon aria-hidden />
                    New {singular.toLowerCase()}
                  </Command.Item>
                );
              })}
            </Command.Group>
          ) : null}
        </Command.List>
      </Command.Root>
    </Command.Dialog>
  );
}
