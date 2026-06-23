// The `/admin` landing screen: a card per collection with its live document
// count. Counts come from the route loader (a server fn the host shim wires) so
// they render in the SSR HTML — no client fetch waterfall. A `slots.dashboard`
// override replaces the default cards entirely.

import { useLoaderData } from "@tanstack/react-router";
import { Dashboard } from "@voila/content-ui";
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
      <section className="space-y-4">
        {admin.slots.dashboard?.header ?? <h1 className="text-lg font-semibold">{title}</h1>}
        {cards({ config: admin.config, counts })}
      </section>
    );
  }

  return (
    <Dashboard
      config={admin.config}
      counts={counts}
      basePath={admin.basePath}
      title={title}
      renderLink={(href, children) => <AdminLink href={href}>{children}</AdminLink>}
    />
  );
}
