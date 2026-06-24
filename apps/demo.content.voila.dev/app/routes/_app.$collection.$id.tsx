import { createFileRoute } from "@tanstack/react-router";
import { CollectionDetailScreen } from "@voila/content-admin/screens";

export const Route = createFileRoute("/_app/$collection/$id")({
  component: CollectionDetailScreen,
});
