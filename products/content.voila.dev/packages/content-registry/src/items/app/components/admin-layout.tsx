// The admin shell — sidebar (nav from your config), header bar, and the content
// area your admin pages render into. Own this file: edit branding, add header
// actions, or swap the nav links for TanStack `<Link>` via `renderLink`. The
// sidebar footer shows the signed-in user and a sign-out button.

import { Link, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@voila/content-ui";
import type { ReactNode } from "react";
import config from "../../content.config";
import type { SessionUser } from "../lib/auth";

async function signOut(): Promise<void> {
  await fetch("/admin/api/auth/sign-out", { method: "POST" }).catch(() => {});
  window.location.assign("/admin/login");
}

function SidebarFooter({ user }: { user: SessionUser }): ReactNode {
  return (
    <div className="flex flex-col gap-1 p-2 text-sm">
      <span className="truncate text-muted-foreground" title={user.email ?? undefined}>
        {user.email ?? "Signed in"}
      </span>
      <button
        type="button"
        onClick={signOut}
        className="text-left font-medium text-primary hover:underline"
      >
        Sign out
      </button>
    </div>
  );
}

export function AdminLayout({
  children,
  user,
}: {
  children: ReactNode;
  user?: SessionUser;
}): ReactNode {
  // Resolve the path through the router (not `window.location`): the router
  // knows the same pathname on the server and the client, so the highlighted
  // nav item matches across hydration. Reading `window` only on the client made
  // the SSR markup (no active item) disagree with the first client render.
  const currentPath = useRouterState({ select: (state) => state.location.pathname });

  return (
    <AdminShell
      config={config}
      currentPath={currentPath}
      renderLink={(item) => <Link to={item.href} />}
      sidebarFooter={user ? <SidebarFooter user={user} /> : undefined}
    >
      {children}
    </AdminShell>
  );
}
