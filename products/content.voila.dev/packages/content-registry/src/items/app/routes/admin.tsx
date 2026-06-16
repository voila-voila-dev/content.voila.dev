import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminLayout } from "../components/admin-layout";
import { fetchSession } from "../lib/auth";

// The `/admin` layout route. `beforeLoad` runs the session guard server-side:
// a signed-out visitor is redirected to `/admin/login` before any admin UI
// renders. The resolved user flows into the layout (shown in the sidebar
// footer) via the route context. Child routes render into the shell's `<Outlet>`.
export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await fetchSession();
    if (!session) throw redirect({ to: "/admin/login" });
    return { user: session.user };
  },
  component: AdminRoute,
});

function AdminRoute() {
  const { user } = Route.useRouteContext();
  return (
    <AdminLayout user={user}>
      <Outlet />
    </AdminLayout>
  );
}
