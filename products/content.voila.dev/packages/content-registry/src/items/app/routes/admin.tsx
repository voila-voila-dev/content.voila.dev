// The `/admin` route. This is a minimal TanStack Start route that mounts the
// admin shell; nested routes (one per collection) render into it. Adjust the
// route definition to match your router setup — the important part is wrapping
// your admin pages in `AdminLayout`.

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminLayout } from "../components/admin-layout";

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
