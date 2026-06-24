import { createFileRoute } from "@tanstack/react-router";
import { CustomScreenDispatcher } from "@voila/content-admin/screens";

// Mounts custom screens registered in `defineAdmin({ screens })` (under the
// guard + shell). Catches admin paths the `$collection` routes don't.
export const Route = createFileRoute("/_app/$")({
  component: CustomScreenDispatcher,
});
