import { createFileRoute } from "@tanstack/react-router";
import { CollectionNewScreen } from "@voila/content-admin/screens";

// The create form for every collection.
export const Route = createFileRoute("/_app/$collection/new")({
  component: CollectionNewScreen,
});
