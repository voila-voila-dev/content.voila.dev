import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "../components/admin-layout";

// The `/admin` layout route. Child routes (the dashboard, each collection's
// list and detail) render into the shell via `<Outlet />`.
export const Route = createFileRoute("/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  );
}
