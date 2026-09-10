import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminProvider } from "@voila/content-admin";
import { AdminLayoutScreen } from "@voila/content-admin/screens";
import { admin } from "../lib/admin";
import { adminHead } from "../lib/admin-head";
import { fetchSession } from "../lib/auth";
import { fetchBrand } from "../lib/brand";

// The authed admin layout — everything under `/admin` except the login page,
// which un-nests itself with a trailing underscore (`admin_.login.tsx`) so a
// signed-out visitor isn't bounced into a redirect loop.
//
// The brand is loaded here, not in the root document, so a public page never
// pays for a `settings` read it doesn't use.
export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const session = await fetchSession();
    if (!session) throw redirect({ to: "/admin/login" });
    return { user: session.user };
  },
  loader: () => fetchBrand(),
  head: ({ loaderData }) => adminHead(loaderData),
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const brand = Route.useLoaderData();
  return (
    <AdminProvider admin={admin} user={user} brand={brand}>
      <AdminLayoutScreen />
    </AdminProvider>
  );
}
