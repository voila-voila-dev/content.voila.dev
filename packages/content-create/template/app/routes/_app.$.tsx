import { createFileRoute } from "@tanstack/react-router";
import { CustomScreenDispatcher } from "@voila/content-admin/screens";

// Mounts custom screens registered in `defineAdmin({ screens })` — the file-free
// way to add admin pages. Catches admin paths the `$collection` routes don't;
// the dispatcher matches against your registered screens and renders the right
// one inside the shell.
export const Route = createFileRoute("/_app/$")({
  component: CustomScreenDispatcher,
});
