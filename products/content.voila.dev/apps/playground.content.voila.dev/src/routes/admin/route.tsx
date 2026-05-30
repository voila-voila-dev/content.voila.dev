// VENDED by @voila/content-registry — you own this file.
// The admin layout: a client-side session guard + sidebar, with everything
// wrapped in the effect-atom `RegistryProvider` so the collection atoms share one
// registry. The guard runs in the browser (no SSR cookie plumbing) — unauthenticated
// visitors are redirected to `/login`.
import { RegistryProvider } from "@effect-atom/atom-react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sidebar } from "~/components/admin/sidebar";
import { getSessionUser } from "~/lib/auth";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "authed">("checking");

  useEffect(() => {
    let active = true;
    getSessionUser().then((user) => {
      if (!active) return;
      if (user) setState("authed");
      else navigate({ to: "/login" });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (state === "checking") {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <RegistryProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </RegistryProvider>
  );
}
