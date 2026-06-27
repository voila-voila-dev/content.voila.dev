// The `/admin` shell screen: the sidebar (nav from config + custom screens), the
// header bar, and the routed page body (`<Outlet>`). Mounted by the host's
// fixed `admin.tsx` guard shim. Reads everything from `AdminProvider` context, so
// it never changes as collections or screens are added.

import { Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell } from "@voila/content-ui";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { resolveBrandLogo } from "../lib/brand-logo";
import { buildExtraGroups } from "../nav";

async function signOut(apiPath: string, loginPath: string): Promise<void> {
  await fetch(`${apiPath}/auth/sign-out`, { method: "POST" }).catch(() => {});
  window.location.assign(loginPath);
}

export function AdminLayoutScreen(): ReactNode {
  const { admin, user } = useAdmin();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });

  const extraGroups = buildExtraGroups({
    screens: admin.screens,
    nav: admin.nav,
    basePath: admin.basePath,
    currentPath,
  });

  const footer =
    admin.slots.shell?.sidebarFooter?.({ user }) ??
    (user ? (
      <div className="flex flex-col gap-1 p-2 text-sm">
        <span className="truncate text-muted-foreground" title={user.email ?? undefined}>
          {user.email ?? "Signed in"}
        </span>
        <button
          type="button"
          onClick={() => signOut(admin.apiPath, `${admin.basePath}/login`)}
          className="text-left font-medium text-primary hover:underline"
        >
          Sign out
        </button>
      </div>
    ) : undefined);

  return (
    <AdminShell
      config={admin.config}
      basePath={admin.basePath}
      currentPath={currentPath}
      renderLink={(item) => <AdminLink href={item.href} />}
      logo={resolveBrandLogo(admin.branding.logo)}
      title={admin.branding.title}
      headerActions={admin.slots.shell?.headerActions}
      sidebarFooter={footer}
      extraGroups={extraGroups}
    >
      <Outlet />
    </AdminShell>
  );
}
