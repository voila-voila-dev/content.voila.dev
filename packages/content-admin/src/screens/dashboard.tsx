// The admin landing screen: a tile per collection with its live document count
// and a quick "New", plus a "Recently edited" feed. Counts come from the route
// loader (a server fn the host shim wires) so they render in the SSR HTML — no
// client fetch waterfall; the feed is fetched client-side (newest `updatedAt`
// per collection, merged). A `slots.dashboard` override replaces the tiles.

import { useQueries } from "@tanstack/react-query";
import { useLoaderData } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import { Dashboard, documentTitle, PageLayout, type RecentItem, useI18n } from "@voila/content-ui";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { type AnyListParams, collectionClient } from "../lib/client-access";

const RECENT_PER_COLLECTION = 5;
const RECENT_TOTAL = 8;

function toTime(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  return 0;
}

export function DashboardScreen(): ReactNode {
  const { admin } = useAdmin();
  const i18n = useI18n();
  const counts = (useLoaderData({ strict: false }) as Record<string, number> | undefined) ?? {};
  const title = admin.branding.title ?? "Overview";
  const collections = Object.values(admin.config.collections) as Collection[];

  // Newest documents per collection, merged and cut to one short feed.
  const recentQueries = useQueries({
    queries: collections.map((collection) => ({
      queryKey: [collection.slug, "recent"],
      queryFn: () =>
        collectionClient(admin.client, collection.slug).list({
          orderBy: "updatedAt",
          order: "desc",
          limit: RECENT_PER_COLLECTION,
        } as AnyListParams),
      staleTime: 15_000,
    })),
  });
  const recentLoading = recentQueries.some((q) => q.isLoading);
  const recent: RecentItem[] = collections
    .flatMap((collection, index) =>
      (recentQueries[index]?.data?.data ?? []).map((row) => ({
        id: String(row.id),
        title: documentTitle(collection, row, i18n) ?? String(row.id),
        collection: collection.label ?? collection.slug,
        href: `${admin.basePath}/${collection.slug}/${String(row.id)}`,
        updatedAt: toTime(row.updatedAt ?? row.createdAt),
      })),
    )
    .sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt))
    .slice(0, RECENT_TOTAL);

  const cards = admin.slots.dashboard?.cards;
  if (cards) {
    return (
      <PageLayout.Root>
        <PageLayout.Header>
          {admin.slots.dashboard?.header ?? <PageLayout.Title>{title}</PageLayout.Title>}
        </PageLayout.Header>
        <PageLayout.Body width="content">{cards({ config: admin.config, counts })}</PageLayout.Body>
      </PageLayout.Root>
    );
  }

  return (
    <Dashboard.Root
      config={admin.config}
      counts={counts}
      basePath={admin.basePath}
      title={title}
      recent={recent}
      recentLoading={recentLoading}
      renderLink={(href, children) => <AdminLink href={href}>{children}</AdminLink>}
    />
  );
}
