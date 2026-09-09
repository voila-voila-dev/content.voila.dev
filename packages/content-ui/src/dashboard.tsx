// Dashboard — the admin landing page, derived from the config: one `StatCard`
// per collection (its icon, live count, and a "New" quick action), each linking
// to that collection's list, plus an optional "Recently edited" feed the host
// supplies (the engine has no cross-collection feed, so the caller fetches it
// however it likes). Counts are passed in by the host too; a missing count
// shows the muted em-dash rather than a misleading zero. Presentational and
// router-agnostic, reusing the same `buildNav` model as `AppSidebar`.

import { PlusIcon } from "@phosphor-icons/react";
import type { NormalizedConfig } from "@voila/content";
import { buttonVariants } from "@voila.dev/ui/button";
import { Card } from "@voila.dev/ui/card";
import { cn } from "@voila.dev/ui/utils";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { NamedIcon } from "./lib/icons";
import { buildNav, DEFAULT_NAV_ICONS, type NavItem } from "./lib/nav";
import { PageLayout } from "./page-layout";
import { Empty, formatDate, relativeDate } from "./widgets/display";

/** One row of the "Recently edited" feed. */
export interface RecentItem {
  readonly id: string;
  readonly title: string;
  /** The collection's label ("Posts"). */
  readonly collection: string;
  readonly href: string;
  readonly updatedAt?: Date | number | string;
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
}

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
  const titleLink = cloneElement(
    renderLink(item.href, item.label) as ReactElement<Record<string, unknown>>,
    {
      className:
        "font-medium text-muted-foreground text-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring",
    },
  );
  const newLink = cloneElement(
    renderLink(
      `${item.href}/new`,
      <>
        <PlusIcon aria-hidden />
        New
      </>,
    ) as ReactElement<Record<string, unknown>>,
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
      <Card.Header className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <span className="flex min-w-0 items-center gap-2">
          <NamedIcon
            name={item.icon}
            fallback={DEFAULT_NAV_ICONS.collection}
            className="size-4 shrink-0 text-muted-foreground"
          />
          {titleLink}
        </span>
        {newLink}
      </Card.Header>
      <Card.Content>
        <div className="font-semibold text-2xl tabular-nums">{count}</div>
      </Card.Content>
    </Card.Root>
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
}: DashboardProps): ReactNode {
  const { collections } = buildNav(config, { basePath });

  return (
    <PageLayout.Root data-slot="dashboard">
      <PageLayout.Header>
        <PageLayout.Title>{title ?? "Overview"}</PageLayout.Title>
      </PageLayout.Header>
      <PageLayout.Body width="content" className="space-y-8">
        {collections.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {recent !== undefined || recentLoading ? (
          <section data-slot="dashboard-recent" className="space-y-3">
            <h2 className="font-medium text-muted-foreground text-sm">Recently edited</h2>
            {recentLoading && (recent === undefined || recent.length === 0) ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : recent === undefined || recent.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing edited yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {recent.map((item) => {
                  const when = toDate(item.updatedAt);
                  return (
                    <li key={`${item.collection}-${item.id}`}>
                      {cloneElement(
                        renderLink(
                          item.href,
                          <>
                            <span className="min-w-0 flex-1 truncate font-medium">
                              {item.title}
                            </span>
                            <span className="shrink-0 text-muted-foreground text-xs">
                              {item.collection}
                            </span>
                            {when ? (
                              <time
                                dateTime={when.toISOString()}
                                title={formatDate(when, "datetime")}
                                className="w-24 shrink-0 text-right text-muted-foreground text-xs"
                              >
                                {relativeDate(when) ?? formatDate(when, "datetime")}
                              </time>
                            ) : null}
                          </>,
                        ) as ReactElement<Record<string, unknown>>,
                        {
                          className:
                            "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none",
                        },
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}
      </PageLayout.Body>
    </PageLayout.Root>
  );
}

/** Config-derived admin landing page. `Dashboard.Root` renders one `StatCard`
 *  per collection (+ quick "New") and an optional recent-edits feed. */
export const Dashboard = {
  Root,
};
