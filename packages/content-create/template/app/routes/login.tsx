import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@voila/content-admin/screens";
import { fetchSession } from "../lib/auth";

// The magic-link login page at `/login` — top-level, so it's outside the root
// guard (a signed-out visitor isn't bounced here in a loop).
export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    if (await fetchSession()) throw redirect({ to: "/" });
  },
  component: LoginScreen,
});
