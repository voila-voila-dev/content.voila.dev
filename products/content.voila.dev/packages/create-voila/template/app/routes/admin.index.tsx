import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@voila/content-ui";
import config from "../../content.config";

// The admin landing page: a card per collection. Pass real document counts
// (e.g. from a loader using the typed client) to fill in the numbers.
export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  return <Dashboard config={config} title="Overview" />;
}
