import { createFileRoute } from "@tanstack/react-router";
import { CollectionDetailScreen } from "@voila/content-admin/screens";

// The detail + edit view for every collection.
export const Route = createFileRoute("/_app/$collection/$id")({
  component: CollectionDetailScreen,
});
