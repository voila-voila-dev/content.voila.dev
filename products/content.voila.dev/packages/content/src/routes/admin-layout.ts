/**
 * `/admin` layout route — wraps every nested admin page in the sidebar shell
 * and supplies the in-shell not-found fallback. Owning the not-found here
 * (rather than via a sibling `admin/$.tsx` splat) avoids the trailing-slash
 * ambiguity that TanStack warns about when `/admin` could resolve to both
 * the index and the splat.
 */
export function adminLayoutSource(configImport: string): string {
  return `import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout, buildAdminHead, EmptyState, PageLayout } from "@voila/content/internal";
import { CompassIcon } from "@voila/ui/icons";
import content from "${configImport}";

export const Route = createFileRoute("/admin")({
  head: () => buildAdminHead(content),
  component: AdminRoute,
  notFoundComponent: AdminNotFound,
});

function AdminRoute() {
  return (
    <AdminLayout config={content}>
      <Outlet />
    </AdminLayout>
  );
}

function AdminNotFound() {
  return (
    <AdminLayout config={content}>
      <PageLayout.Root>
        <PageLayout.Body>
          <EmptyState
            icon={CompassIcon}
            title="Page not found"
            description="No admin page at this URL."
          />
        </PageLayout.Body>
      </PageLayout.Root>
    </AdminLayout>
  );
}
`;
}

/** `/admin/` dashboard route. */
export function adminIndexSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@voila/content/internal";
import content from "${configImport}";

export const Route = createFileRoute("/admin/")({
  component: () => <AdminDashboard config={content} />,
});
`;
}
