import { useQueries } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@voila/content-ui";
import config from "../../content.config";
import { client } from "../lib/content-client";

// The admin landing page: a card per collection with its live document count
// (one `list({ count: true })` per collection; `status: "any"` includes drafts).
export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  // `Object.keys` widens to `string[]`; the assertion just recovers the literal
  // slug union so `client[slug]` stays typed (the keys *are* the config's).
  const slugs = Object.keys(config.collections) as Array<keyof typeof config.collections>;

  // One count query per collection, fetched in parallel and cached by slug.
  // A failed count just leaves the card's em-dash placeholder.
  const results = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: ["count", slug],
      queryFn: () => client[slug].list({ limit: 1, count: true, status: "any" }),
    })),
  });

  const counts: Record<string, number> = {};
  slugs.forEach((slug, i) => {
    const total = results[i]?.data?.total;
    if (total !== undefined) counts[slug] = total;
  });

  return <Dashboard config={config} title="Overview" counts={counts} />;
}
