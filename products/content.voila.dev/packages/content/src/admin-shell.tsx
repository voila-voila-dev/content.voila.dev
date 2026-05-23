import { PageLayout } from "./admin/page-layout.tsx";
import { AdminSidebar } from "./admin/sidebar.tsx";
import type { ResolvedContentConfig } from "./types.ts";

/**
 * Admin route component. Renders the persistent sidebar + main content area.
 *
 * The root element keeps `data-mount-*` and `data-brand-name` attributes so
 * downstream tooling (and tests) can still resolve config from the DOM.
 */
export function AdminShell({ config }: { config: ResolvedContentConfig }) {
  const name = config.branding.name ?? "Voila";
  return (
    <div
      id="voila-admin"
      data-mount-admin={config.mount.admin}
      data-mount-api={config.mount.api}
      data-brand-name={name}
      className="font-sans"
    >
      <AdminSidebar config={config}>
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
      </AdminSidebar>
    </div>
  );
}
