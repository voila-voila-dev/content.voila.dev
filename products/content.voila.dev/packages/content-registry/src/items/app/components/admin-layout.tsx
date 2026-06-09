// The admin shell for your app — the sidebar (nav built from your config), the
// header bar, and the content area that your admin pages render into. This is
// vended source: own it. Edit the branding, add header actions (a user menu, a
// theme toggle), or swap the plain `<a>` nav links for your router's `<Link>`
// via `renderLink`.

import { AdminShell } from "@voila/content-ui";
import type { ReactNode } from "react";
import config from "../../content.config";

export function AdminLayout({ children }: { children: ReactNode }): ReactNode {
  // The current path highlights the active collection in the sidebar. On the
  // server (SSR) there's no `window`; the client fills it in on hydration.
  const currentPath = typeof window === "undefined" ? undefined : window.location.pathname;

  return (
    <AdminShell config={config} currentPath={currentPath}>
      {children}
    </AdminShell>
  );
}
