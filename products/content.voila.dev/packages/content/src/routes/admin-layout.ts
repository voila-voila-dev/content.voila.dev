/**
 * `/admin` layout route — wraps every nested admin page in the sidebar shell
 * and supplies the in-shell not-found fallback. Owning the not-found here
 * (rather than via a sibling `admin/$.tsx` splat) avoids the trailing-slash
 * ambiguity that TanStack warns about when `/admin` could resolve to both
 * the index and the splat.
 *
 * Session enforcement lives in an isomorphic helper: the `.server()` branch
 * runs the real `requireSession` check; the `.client()` branch is a no-op.
 * The TanStack vite plugin strips the server body from the client bundle,
 * so `@tanstack/react-start/server` never reaches the browser (and the
 * import-protection plugin stays quiet).
 *
 * `AdminNotFound` deliberately does NOT wrap itself in `<AdminLayout>` —
 * the notFoundComponent renders inside the parent route's outlet, so the
 * sidebar shell is already supplied. Re-wrapping would render two sidebars.
 */
export function adminLayoutSource(configImport: string): string {
  return `import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { AdminLayout, buildAdminHead, EmptyState, PageLayout } from "@voila/content/internal";
import { CompassIcon } from "@voila/ui/icons";
import content from "${configImport}";

type GuardResult =
  | { kind: "allow"; session: unknown }
  | { kind: "anonymous" }
  | { kind: "redirect"; to: string };

const runAuthGuard = createIsomorphicFn()
  .server(async (): Promise<GuardResult> => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { requireSession } = await import("@voila/content-auth/middleware");
    // The layout file sits at src/routes/admin.tsx; the auth singleton
    // lives one directory deeper at src/routes/admin/-auth-server.ts.
    const { getAuth } = await import("./admin/-auth-server");
    return requireSession(getRequest(), { auth: getAuth() });
  })
  .client((): GuardResult => ({ kind: "anonymous" }));

export const Route = createFileRoute("/admin")({
  head: () => buildAdminHead(content),
  beforeLoad: async () => {
    const guard = await runAuthGuard();
    if (guard.kind === "redirect") throw redirect({ to: guard.to });
    return { session: guard.kind === "allow" ? guard.session : null };
  },
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
    <PageLayout.Root>
      <PageLayout.Body>
        <EmptyState
          icon={CompassIcon}
          title="Page not found"
          description="No admin page at this URL."
        />
      </PageLayout.Body>
    </PageLayout.Root>
  );
}
`;
}

/** \`/admin/\` dashboard route. */
export function adminIndexSource(configImport: string): string {
  return `import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@voila/content/internal";
import content from "${configImport}";

export const Route = createFileRoute("/admin/")({
  component: () => <AdminDashboard config={content} />,
});
`;
}
