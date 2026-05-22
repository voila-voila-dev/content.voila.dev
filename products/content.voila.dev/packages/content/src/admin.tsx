import type { ReactElement } from "react";
import { AdminShell } from "./admin-shell.tsx";
import { SetupPage } from "./setup-page.tsx";
import type { Content } from "./types.ts";

/**
 * Structurally compatible with TanStack Router's route options. Kept loose
 * so this package doesn't have to pin a TanStack Router type version; the
 * vite plugin (and any escape-hatch consumers) feed it straight into
 * `createFileRoute(path)(...)`.
 */
export type RouteOptions = {
  component: () => ReactElement;
};

export function adminRouteOptions(content: Content): RouteOptions {
  return {
    component: function AdminRouteComponent() {
      return <AdminShell config={content} />;
    },
  };
}

export function setupRouteOptions(content: Content): RouteOptions {
  return {
    component: function SetupRouteComponent() {
      return <SetupPage config={content} />;
    },
  };
}
