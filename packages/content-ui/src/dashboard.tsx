// Dashboard — the admin landing page, derived from the config. Three blocks:
//
//   • Stat tiles — one per collection (icon, live count, quick "New"), each a
//     link to that collection's list.
//   • Recently edited — a cross-collection feed the host supplies (the engine
//     has no feed endpoint, so the caller fetches and merges it), each row with
//     the collection's icon, the document title, its publish status when the
//     collection has drafts, and a relative time.
//   • Shortcuts — search (⌘K), "New …" per collection, and the singletons.
//
// Counts are passed in by the host too; a missing count shows the muted em-dash
// rather than a misleading zero. Presentational and router-agnostic, reusing the
// same `buildNav` model as `AppSidebar`.

import { ArrowRightIcon, MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import type { NormalizedConfig } from "@voila/content";
import { Button, buttonVariants } from "@voila.dev/ui/button";
import { Card } from "@voila.dev/ui/card";
import { Kbd } from "@voila.dev/ui/kbd";
import { cn } from "@voila.dev/ui/utils";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { NamedIcon } from "./lib/icons";
import { buildNav, DEFAULT_NAV_ICONS, type NavItem } from "./lib/nav";
import { PageLayout } from "./page-layout";
import { Empty, formatDate, relativeDate } from "./widgets/display";
import { StatusBadge } from "./widgets/status-badge";

/** One row of the "Recently edited" feed. */
export interface RecentItem {
  readonly id: string;
  readonly title: string;
  /** The collection's label ("Posts"). */
  readonly collection: string;
  /** The collection's Phosphor icon name. */
  readonly icon?: string;
  readonly href: string;
  readonly updatedAt?: Date | number | string;
  /** The stored document, when the collection has drafts (for the status badge). */
  readonly doc?: Readonly<Record<string, unknown>>;
}

export interface DashboardProps {
  readonly config: NormalizedConfig;
  /** Document count per collection slug. Missing slugs render an em-dash. */
  readonly counts?: Readonly<Record<string, number>>;
  /** URL prefix the admin is mounted under. Defaults to `/admin`. */
  readonly basePath?: string;
  /** Render a card's link element (e.g. a framework `Link`). */
  readonly renderLink?: (href: string, children: ReactNode) => ReactElement;
  readonly title?: ReactNode;
  /** Shown when the config has no collections. */
  readonly emptyMessage?: string;
  /** Recently edited documents across collections, newest first. */
  readonly recent?: readonly RecentItem[];
  readonly recentLoading?: boolean;
  /** Opens the command palette; renders the Search shortcut when set. */
  readonly onSearch?: () => void;
}

type LinkElement = ReactElement<Record<string, unknown>>;

function formatCount(counts: DashboardProps["counts"], slug: string): ReactNode {
  const n = counts?.[slug];
  return typeof n === "number" ? n.toLocaleString() : <Empty />;
}

function defaultRenderLink(href: string, children: ReactNode): ReactElement {
  return <a href={href}>{children}</a>;
}

function toDate(value: RecentItem["updatedAt"]): Date | undefined {
  if (value === undefined) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * One collection tile: the label is a "stretched" link covering the whole card
 * (so the tile reads as one target without nesting anchors), the count sits
 * below, and a "New" quick action floats above the stretched link.
 */
function CollectionTile({
  item,
  count,
  renderLink,
}: {
  readonly item: NavItem;
  readonly count: ReactNode;
  readonly renderLink: (href: string, children: ReactNode) => ReactElement;
}): ReactNode {
  const titleLink = cloneElement(renderLink(item.href, item.label) as LinkElement, {
    className:
      "truncate font-medium text-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring",
  });
  const newLink = cloneElement(
    renderLink(
      `${item.href}/new`,
      <>
        <PlusIcon aria-hidden />
        New
      </>,
    ) as LinkElement,
    {
      className: cn(
        buttonVariants({ variant: "ghost", size: "xs" }),
        "relative z-10 -mr-1 text-muted-foreground",
      ),
      title: "Create new",
    },
  );
  return (
    <Card.Root
      data-slot="collection-tile"
      className="relative transition-colors hover:bg-accent/40"
    >
      <Card.Content className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-5">
          <NamedIcon name={item.icon} fallback={DEFAULT_NAV_ICONS.collection} />
        </span>
        <span className="grid min-w-0 flex-1 leading-tight">
          {titleLink}
          <span className="font-semibold text-2xl tabular-nums">{count}</span>
        </span>
        {newLink}
      </Card.Content>
    </Card.Root>
  );
}

function RecentList({
  recent,
  loading,
  renderLink,
}: {
  readonly recent?: readonly RecentItem[];
  readonly loading: boolean;
  readonly renderLink: (href: string, children: ReactNode) => ReactElement;
}): ReactNode {
  if (loading && (recent === undefined || recent.length === 0)) {
    return <p className="px-4 py-6 text-center text-muted-foreground text-sm">Loading…</p>;
  }
  if (recent === undefined || recent.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-muted-foreground text-sm">
        Nothing edited yet. Create a record and it will show up here.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {recent.map((item) => {
        const when = toDate(item.updatedAt);
        return (
          <li key={`${item.collection}-${item.id}`}>
            {cloneElement(
              renderLink(
                item.href,
                <>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
                    <NamedIcon name={item.icon} fallback={DEFAULT_NAV_ICONS.collection} />
                  </span>
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium">{item.title}</span>
                    <span className="truncate text-muted-foreground text-xs">
                      {item.collection}
                    </span>
                  </span>
                  {item.doc ? <StatusBadge doc={item.doc} /> : null}
                  {when ? (
                    <time
                      dateTime={when.toISOString()}
                      title={formatDate(when, "datetime")}
                      className="shrink-0 text-muted-foreground text-xs"
                    >
                      {relativeDate(when) ?? formatDate(when, "datetime")}
                    </time>
                  ) : null}
                  <ArrowRightIcon
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                  />
                </>,
              ) as LinkElement,
              {
                className:
                  "group flex items-center gap-3 px-4 py-2.5 text-sm outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50",
              },
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Root({
  config,
  counts,
  basePath,
  renderLink = defaultRenderLink,
  title,
  emptyMessage = "No collections configured.",
  recent,
  recentLoading = false,
  onSearch,
}: DashboardProps): ReactNode {
  const { collections, singletons } = buildNav(config, { basePath });

  return (
    <PageLayout.Root data-slot="dashboard">
      <PageLayout.Header>
        <PageLayout.Title>{title ?? "Overview"}</PageLayout.Title>
      </PageLayout.Header>
      <PageLayout.Body width="content" className="space-y-6">
        {collections.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((item) => (
              <CollectionTile
                key={item.slug}
                item={item}
                count={formatCount(counts, item.slug)}
                renderLink={renderLink}
              />
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {recent !== undefined || recentLoading ? (
            <section data-slot="dashboard-recent" className="min-w-0 space-y-2">
              <h2 className="px-1 font-medium text-muted-foreground text-sm">Recently edited</h2>
              <div className="overflow-hidden rounded-lg border">
                <RecentList recent={recent} loading={recentLoading} renderLink={renderLink} />
              </div>
            </section>
          ) : null}

          <section data-slot="dashboard-shortcuts" className="min-w-0 space-y-2">
            <h2 className="px-1 font-medium text-muted-foreground text-sm">Shortcuts</h2>
            <div className="flex flex-col gap-1 rounded-lg border p-2">
              {onSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={onSearch}
                >
                  <MagnifyingGlassIcon aria-hidden />
                  <span className="flex-1 text-left">Search or jump to…</span>
                  <Kbd.Root>⌘K</Kbd.Root>
                </Button>
              ) : null}
              {collections.map((item) =>
                cloneElement(
                  renderLink(
                    `${item.href}/new`,
                    <>
                      <PlusIcon aria-hidden />
                      New {item.label.toLowerCase().replace(/s$/, "")}
                    </>,
                  ) as LinkElement,
                  {
                    key: `new-${item.slug}`,
                    className: cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "justify-start",
                    ),
                  },
                ),
              )}
              {singletons.map((item) =>
                cloneElement(
                  renderLink(
                    item.href,
                    <>
                      <NamedIcon name={item.icon} fallback={DEFAULT_NAV_ICONS.singleton} />
                      {item.label}
                    </>,
                  ) as LinkElement,
                  {
                    key: `singleton-${item.slug}`,
                    className: cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "justify-start",
                    ),
                  },
                ),
              )}
            </div>
          </section>
        </div>
      </PageLayout.Body>
    </PageLayout.Root>
  );
}

/** Config-derived admin landing page. `Dashboard.Root` renders one tile per
 *  collection (+ quick "New"), a recent-edits feed and a shortcuts card. */
export const Dashboard = {
  Root,
};
