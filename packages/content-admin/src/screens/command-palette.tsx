// CommandPalette — the ⌘K entry point: jump to any collection / singleton /
// custom screen, start a "New …" in one keystroke, and search the documents of
// every search-enabled collection (server-side `client.<slug>.search`) as you
// type. Opened from the sidebar's search row or the ⌘K shortcut; owned by the
// shell layout so it's available on every screen.

import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import {
  buildNav,
  DEFAULT_NAV_ICONS,
  documentTitle,
  homeHref,
  NamedIcon,
  searchEnabled,
  singularLabel,
  useI18n,
} from "@voila/content-ui";
import { Command } from "@voila.dev/ui/command";
import { type ReactNode, useEffect, useState } from "react";
import { useAdmin } from "../context";
import { collectionClient } from "../lib/client-access";
import { buildExtraGroups } from "../nav";

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

  const nav = buildNav(admin.config, { basePath: admin.basePath });
  const extra = buildExtraGroups({
    screens: admin.screens,
    nav: admin.nav,
    basePath: admin.basePath,
  });

  // Only search-enabled collections are queried, and only once there's a term.
  const searchable = (Object.values(admin.config.collections) as Collection[]).filter((c) =>
    searchEnabled(c.search),
  );
  const results = useQueries({
    queries: searchable.map((collection) => ({
      queryKey: ["palette", collection.slug, term],
      queryFn: () => collectionClient(admin.client, collection.slug).search(term, { limit: 5 }),
      enabled: open && term.length >= 2,
      staleTime: 10_000,
    })),
  });

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

          {searchable.length > 0 && term.length >= 2
            ? searchable.map((collection, index) => {
                const page = results[index]?.data;
                if (!page || page.data.length === 0) return null;
                return (
                  <Command.Group
                    key={`search-${collection.slug}`}
                    heading={collection.label ?? collection.slug}
                  >
                    {page.data.map((row) => {
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

          {nav.collections.length > 0 ? (
            <Command.Group heading="Create">
              {nav.collections.map((item) => {
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
