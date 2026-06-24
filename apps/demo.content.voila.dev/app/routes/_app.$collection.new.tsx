import { createFileRoute } from "@tanstack/react-router";
import { CollectionNewScreen } from "@voila/content-admin/screens";

export const Route = createFileRoute("/_app/$collection/new")({
  component: CollectionNewScreen,
});
