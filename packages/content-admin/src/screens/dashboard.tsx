// The `/admin` landing screen: a card per collection with its live document
// count. Counts come from the route loader (a server fn the host shim wires) so
// they render in the SSR HTML — no client fetch waterfall. A `slots.dashboard`
// override replaces the default cards entirely.

import { useLoaderData } from "@tanstack/react-router";
import { Dashboard, PageLayout } from "@voila/content-ui";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";

export function DashboardScreen(): ReactNode {
  const { admin } = useAdmin();
  const counts = (useLoaderData({ strict: false }) as Record<string, number> | undefined) ?? {};
  const title = admin.branding.title ?? "Overview";

  const cards = admin.slots.dashboard?.cards;
  if (cards) {
    return (
      <PageLayout.Root>
        <PageLayout.Header>
          {admin.slots.dashboard?.header ?? <PageLayout.Title>{title}</PageLayout.Title>}
        </PageLayout.Header>
        <PageLayout.Body>{cards({ config: admin.config, counts })}</PageLayout.Body>
      </PageLayout.Root>
    );
  }

  return (
    <Dashboard.Root
      config={admin.config}
      counts={counts}
      basePath={admin.basePath}
      title={title}
      renderLink={(href, children) => <AdminLink href={href}>{children}</AdminLink>}
    />
  );
}
