import { createFileRoute } from "@tanstack/react-router";
import { CollectionDetailScreen } from "@voila/content-admin/screens";

// A document's field-group section as a route (`/posts/123/content`) — the same
// detail screen, reading `group` from the URL; the sidebar lists the sections.
export const Route = createFileRoute("/_app/$collection/$id/$group")({
  component: CollectionDetailScreen,
});
