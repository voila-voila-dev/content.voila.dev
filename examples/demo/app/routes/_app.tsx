import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminProvider } from "@voila/content-admin";
import { AdminLayoutScreen } from "@voila/content-admin/screens";
import { admin } from "../lib/admin";
import { fetchSession } from "../lib/auth";

// The authed admin layout. Pathless (`_app`) so it adds no URL segment — the
// admin lives at the root (`/`, `/posts`, …), not under `/admin`. `beforeLoad`
// runs the session guard; the resolved user is re-provided so the shell shows it.
export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const session = await fetchSession();
    if (!session) throw redirect({ to: "/login" });
    return { user: session.user };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AdminProvider admin={admin} user={user}>
      <AdminLayoutScreen />
    </AdminProvider>
  );
}
