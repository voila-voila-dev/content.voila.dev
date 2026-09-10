// Mounts config-registered custom screens (the file-free "add a screen" path).
// The host's single `_app.$.tsx` catch-all renders this; it matches the path
// under the admin base against `admin.screens`, runs the screen's loader
// client-side (React Query), and renders its component inside the guard + shell.
// A power user who wants SSR/typed params for a screen can instead drop a literal
// route shim — it out-ranks the catch-all. An unmatched path renders a styled
// 404 page (in the same frame every other page uses) with a way home.

import { CompassIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { homeHref, PageLayout } from "@voila/content-ui";
import { buttonVariants } from "@voila.dev/ui/button";
import { Empty } from "@voila.dev/ui/empty";
import { cn } from "@voila.dev/ui/utils";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { matchScreen } from "../lib/match";

/** The framed "nothing here" page. */
export function NotFoundScreen({ path }: { readonly path?: string }): ReactNode {
  const { admin } = useAdmin();
  return (
    <PageLayout.Root data-slot="not-found">
      <PageLayout.Header>
        <PageLayout.Title>Not found</PageLayout.Title>
      </PageLayout.Header>
      <PageLayout.Body width="content">
        <Empty.Root bordered className="py-16">
          <Empty.Header>
            <Empty.Media variant="icon">
              <CompassIcon />
            </Empty.Media>
            <Empty.Title>There's nothing at this address</Empty.Title>
            <Empty.Description>
              {path ? (
                <>
                  No collection or screen is registered for <code className="text-xs">{path}</code>.
                </>
              ) : (
                "No collection or screen is registered for this path."
              )}
            </Empty.Description>
          </Empty.Header>
          <Empty.Content>
            <AdminLink
              href={homeHref(admin.basePath)}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Back to overview
            </AdminLink>
          </Empty.Content>
        </Empty.Root>
      </PageLayout.Body>
    </PageLayout.Root>
  );
}

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

  if (!match) return <NotFoundScreen path={relative} />;

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
