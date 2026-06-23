// Mounts config-registered custom screens (the file-free "add a screen" path).
// The host's single `admin.$.tsx` catch-all renders this; it matches the path
// under the admin base against `admin.screens`, runs the screen's loader
// client-side (React Query), and renders its component inside the guard + shell.
// A power user who wants SSR/typed params for a screen can instead drop a literal
// route shim — it out-ranks the catch-all.

import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { matchScreen } from "../lib/match";

export function CustomScreenDispatcher(): ReactNode {
  const { admin } = useAdmin();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // The path under the admin base, e.g. "/admin/analytics" → "/analytics".
  const relative = pathname.startsWith(admin.basePath)
    ? pathname.slice(admin.basePath.length) || "/"
    : pathname;
  const match = matchScreen(admin.screens, relative);

  const loader = match?.screen.loader;
  const query = useQuery({
    queryKey: ["custom-screen", match?.screen.id, relative],
    queryFn: () => loader?.({ client: admin.client, params: match?.params ?? {} }),
    enabled: match !== null && loader !== undefined,
  });

  if (!match) {
    return (
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Not found</h1>
        <p className="text-sm text-muted-foreground">No screen is registered for this path.</p>
      </section>
    );
  }

  const Component = match.screen.component;
  return (
    <Component
      client={admin.client}
      params={match.params}
      data={loader ? query.data : undefined}
      config={admin.config}
    />
  );
}
