import { createFileRoute } from "@tanstack/react-router";
import { CollectionListScreen } from "@voila/content-admin/screens";

// The list page for EVERY collection (`/posts`, …) — one file, not one per
// collection. The screen reads `$collection` against your config, so adding a
// collection to `content.config.ts` needs no new route file.
export const Route = createFileRoute("/_app/$collection/")({
  component: CollectionListScreen,
});
