// The admin shell — sidebar (nav from your config), header bar, and the content
// area your admin pages render into. Own this file: edit branding, add header
// actions, or swap the nav links for TanStack `<Link>` via `renderLink`.

import { Link } from "@tanstack/react-router";
import { AdminShell } from "@voila/content-ui";
import type { ReactNode } from "react";
import config from "../../content.config";

export function AdminLayout({ children }: { children: ReactNode }): ReactNode {
  const currentPath = typeof window === "undefined" ? undefined : window.location.pathname;

  return (
    <AdminShell
      config={config}
      currentPath={currentPath}
      renderLink={(item) => <Link to={item.href} />}
    >
      {children}
    </AdminShell>
  );
}
