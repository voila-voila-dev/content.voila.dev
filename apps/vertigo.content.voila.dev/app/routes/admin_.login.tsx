import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminProvider } from "@voila/content-admin";
import { LoginScreen } from "@voila/content-admin/screens";
import { admin } from "../lib/admin";
import { adminHead } from "../lib/admin-head";
import { fetchSession } from "../lib/auth";

// The magic-link login page at `/admin/login`. The TRAILING UNDERSCORE on
// `admin_` is load-bearing: it keeps this route OUT of `admin.tsx`'s guard, so a
// signed-out visitor sent here isn't immediately redirected here again.
//
// It provides its own `AdminProvider` for the same reason — it has no guarded
// layout above it to inherit one from.
export const Route = createFileRoute("/admin_/login")({
  beforeLoad: async () => {
    if (await fetchSession()) throw redirect({ to: "/admin" });
  },
  head: () => adminHead(),
  component: Login,
});

function Login() {
  return (
    <AdminProvider admin={admin}>
      <LoginScreen />
    </AdminProvider>
  );
}
