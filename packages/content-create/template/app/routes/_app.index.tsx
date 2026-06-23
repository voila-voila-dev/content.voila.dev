import { createFileRoute } from "@tanstack/react-router";
import { DashboardScreen } from "@voila/content-admin/screens";
import { fetchCounts } from "../lib/counts";

// The dashboard at `/` — a card per collection with its live document count.
// The counts come from the route loader (a server fn), so they render in the SSR
// HTML — no client-side fetch waterfall.
export const Route = createFileRoute("/_app/")({
  loader: () => fetchCounts(),
  component: DashboardScreen,
});
