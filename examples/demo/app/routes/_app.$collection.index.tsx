import { createFileRoute } from "@tanstack/react-router";
import { CollectionListScreen } from "@voila/content-admin/screens";

// The list page for every collection (`/posts`, …) — one file, config-driven.
export const Route = createFileRoute("/_app/$collection/")({
  component: CollectionListScreen,
});
