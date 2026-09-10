import { createFileRoute } from "@tanstack/react-router";
import { DashboardScreen } from "@voila/content-admin/screens";
import { fetchCounts } from "../lib/counts";

// The dashboard at `/admin` — a card per collection with its live count, counted
// against the same D1 the public site reads (SSR'd, no client waterfall).
export const Route = createFileRoute("/admin/")({
  loader: () => fetchCounts(),
  component: DashboardScreen,
});
