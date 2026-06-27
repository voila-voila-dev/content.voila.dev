// Dashboard — the admin landing grid, derived from the config: one `StatCard`
// per collection showing its document count, linking to that collection's list.
// Counts are passed in by the host (the engine has no count endpoint, so the
// caller supplies them however it likes); a missing count shows the muted
// em-dash rather than a misleading zero. Presentational and router-agnostic,
// reusing the same `buildNav` model as `AppSidebar` for labels and hrefs.

import type { NormalizedConfig } from "@voila/content";
import type { ReactElement, ReactNode } from "react";
import { buildNav } from "./lib/nav";
import { PageLayout } from "./page-layout";
import { Empty } from "./widgets/display";
import { StatCard } from "./widgets/stat-card";

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
}

function formatCount(counts: DashboardProps["counts"], slug: string): ReactNode {
  const n = counts?.[slug];
  return typeof n === "number" ? n.toLocaleString() : <Empty />;
}

function Root({
  config,
  counts,
  basePath,
  renderLink,
  title,
  emptyMessage = "No collections configured.",
}: DashboardProps): ReactNode {
  const { collections } = buildNav(config, { basePath });

  return (
    <PageLayout.Root data-slot="dashboard">
      {title ? (
        <PageLayout.Header>
          <PageLayout.Title>{title}</PageLayout.Title>
        </PageLayout.Header>
      ) : null}
      <PageLayout.Body>
        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((item) => (
              <StatCard
                key={item.slug}
                label={item.label}
                value={formatCount(counts, item.slug)}
                href={item.href}
                renderLink={renderLink}
              />
            ))}
          </div>
        )}
      </PageLayout.Body>
    </PageLayout.Root>
  );
}

/** Config-derived admin landing grid. `Dashboard.Root` renders one `StatCard`
 *  per collection. */
export const Dashboard = {
  Root,
};
