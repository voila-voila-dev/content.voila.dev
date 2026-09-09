// The admin shell screen: the sidebar (nav from config + custom screens, or the
// current entity's section), the routed page body (`<Outlet>`), the account
// menu in the sidebar footer, the ⌘K command palette, and the toast host.
// Mounted by the host's fixed `_app.tsx` guard shim. Reads everything from
// `AdminProvider` context, so it never changes as collections or screens are
// added. There is no shell header bar — each page renders its own single
// `PageLayout.Header` (trigger · back · title · actions · theme).

import { useQuery } from "@tanstack/react-query";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { AdminShell, UserMenu } from "@voila/content-ui";
import { Toaster } from "@voila.dev/ui/sonner";
import { type ReactNode, useEffect, useState } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { resolveBrandLogo } from "../lib/brand-logo";
import { buildExtraGroups } from "../nav";
import { CommandPalette } from "./command-palette";

async function signOut(apiPath: string, loginPath: string): Promise<void> {
  await fetch(`${apiPath}/auth/sign-out`, { method: "POST" }).catch(() => {});
  window.location.assign(loginPath);
}

/** The per-collection counts (sidebar badges), when the host wired a resolver. */
export function useCounts(): Readonly<Record<string, number>> | undefined {
  const { admin } = useAdmin();
  const query = useQuery({
    queryKey: ["admin", "counts"],
    queryFn: () => admin.counts?.() ?? Promise.resolve({}),
    enabled: admin.counts !== undefined,
    staleTime: 15_000,
  });
  return admin.counts ? query.data : undefined;
}

export function AdminLayoutScreen(): ReactNode {
  const { admin, user } = useAdmin();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const counts = useCounts();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K opens the palette from anywhere in the shell.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const extraGroups = buildExtraGroups({
    screens: admin.screens,
    nav: admin.nav,
    basePath: admin.basePath,
    currentPath,
  });

  const footer =
    admin.slots.shell?.sidebarFooter?.({ user }) ??
    (user ? (
      <UserMenu
        email={user.email}
        onSignOut={() => signOut(admin.apiPath, `${admin.basePath}/login`)}
      />
    ) : undefined);

  return (
    <AdminShell
      config={admin.config}
      basePath={admin.basePath}
      currentPath={currentPath}
      renderLink={(item) => <AdminLink href={item.href} />}
      logo={resolveBrandLogo(admin.branding.logo)}
      brandSubtitle={admin.slots.shell?.brandSubtitle ?? admin.branding.title}
      sidebarFooter={footer}
      extraGroups={extraGroups}
      counts={counts}
      onSearch={() => setPaletteOpen(true)}
    >
      <Outlet />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <Toaster position="bottom-right" richColors closeButton />
    </AdminShell>
  );
}
