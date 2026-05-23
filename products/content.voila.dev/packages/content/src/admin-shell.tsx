import type { ReactNode } from "react";
import { PageLayout } from "./admin/page-layout.tsx";
import { AdminSidebar } from "./admin/sidebar.tsx";
import type { ResolvedContentConfig } from "./types.ts";

/**
 * Layout wrapper used by every admin route. Renders the persistent sidebar
 * around its `children` (usually an `<Outlet/>` so nested routes plug in).
 *
 * The root element keeps `data-mount-*` and `data-brand-name` attributes so
 * downstream tooling (and tests) can still resolve config from the DOM.
 */
export function AdminLayout({
  config,
  children,
}: {
  config: ResolvedContentConfig;
  children: ReactNode;
}) {
  const name = config.branding.name ?? "Voila";
  return (
    <div
      id="voila-admin"
      data-mount-admin={config.mount.admin}
      data-mount-api={config.mount.api}
      data-brand-name={name}
      className="font-sans"
    >
      <AdminSidebar config={config}>{children}</AdminSidebar>
    </div>
  );
}

/**
 * Default dashboard rendered at the admin index. Kept simple intentionally —
 * the entry surface is the sidebar, not this page. M2+ may grow this into a
 * stats overview.
 */
export function AdminDashboard({ config }: { config: ResolvedContentConfig }) {
  const name = config.branding.name ?? "Voila";
  return (
    <PageLayout.Root>
      <PageLayout.Header>
        <PageLayout.Title>{name}</PageLayout.Title>
      </PageLayout.Header>
      <PageLayout.Body>
        <p className="text-muted-foreground text-sm">
          Select a collection or singleton from the sidebar to get started.
        </p>
      </PageLayout.Body>
    </PageLayout.Root>
  );
}

/**
 * Convenience wrapper kept for the original `/admin/$` codegen and the
 * existing snapshot tests: composes `AdminLayout` around `AdminDashboard`.
 */
export function AdminShell({ config }: { config: ResolvedContentConfig }) {
  return (
    <AdminLayout config={config}>
      <AdminDashboard config={config} />
    </AdminLayout>
  );
}
