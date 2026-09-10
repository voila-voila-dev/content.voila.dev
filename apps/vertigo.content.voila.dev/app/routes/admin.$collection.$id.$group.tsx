import { createFileRoute } from "@tanstack/react-router";
import { CollectionDetailScreen } from "@voila/content-admin/screens";

// A document's field-group section as a route (`/admin/films/123/credits`) — the
// same detail screen, reading `group` from the URL; the sidebar lists sections.
export const Route = createFileRoute("/admin/$collection/$id/$group")({
  component: CollectionDetailScreen,
});
