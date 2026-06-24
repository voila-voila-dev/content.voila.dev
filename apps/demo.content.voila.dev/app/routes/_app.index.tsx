import { createFileRoute } from "@tanstack/react-router";
import { DashboardScreen } from "@voila/content-admin/screens";
import { fetchCounts } from "../lib/counts";

// The dashboard at `/` — a card per collection with its live count (SSR'd via
// the loader, no client waterfall).
export const Route = createFileRoute("/_app/")({
  loader: () => fetchCounts(),
  component: DashboardScreen,
});
