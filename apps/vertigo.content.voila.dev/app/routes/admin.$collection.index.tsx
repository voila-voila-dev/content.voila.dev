import { createFileRoute } from "@tanstack/react-router";
import { CollectionListScreen } from "@voila/content-admin/screens";

// The list page for every collection (`/admin/films`, …) and the editor for
// every singleton (`/admin/settings`) — one file, config-driven.
export const Route = createFileRoute("/admin/$collection/")({
  component: CollectionListScreen,
});
