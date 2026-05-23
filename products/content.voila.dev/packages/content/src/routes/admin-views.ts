/**
 * Source generators for the read-only admin view routes:
 *
 *   /admin/collections/$collection          → list view
 *   /admin/collections/$collection/$id      → detail view
 *   /admin/singletons/$singleton            → singleton view
 *
 * Each file declares a TanStack route whose `loader` calls
 * `queryClient.ensureQueryData` to prefetch the read endpoint on the server,
 * and a component that calls `useSuspenseQuery` on the same key so SSR hands
 * fully-resolved data to the client without a render-blocking fetch.
 *
 * The router is expected to expose a `queryClient` on its context via
 * `setupRouterSsrQueryIntegration` (wired in the playground's router.tsx).
 */

const SEARCH_SCHEMA = `(search: Record<string, unknown>): { cursor?: string; orderBy?: string; order?: "asc" | "desc" } => {
  const cursor = typeof search.cursor === "string" ? search.cursor : undefined;
  const orderBy = typeof search.orderBy === "string" ? search.orderBy : undefined;
  const order: "asc" | "desc" | undefined =
    search.order === "asc" ? "asc" : search.order === "desc" ? "desc" : undefined;
  return { cursor, orderBy, order };
}`;

export function adminCollectionListSource(configImport: string): string {
  return `import { createFileRoute, notFound } from "@tanstack/react-router";
import { CollectionListView, getCollection } from "@voila/content/internal";
import content from "${configImport}";

export const Route = createFileRoute("/admin/collections/$collection/")({
  validateSearch: ${SEARCH_SCHEMA},
  component: RouteComponent,
});

function RouteComponent() {
  const { collection: slug } = Route.useParams();
  const collection = getCollection(content, slug);
  if (!collection) throw notFound();
  return <CollectionListView config={content} collection={collection} />;
}
`;
}

export function adminCollectionDetailSource(configImport: string): string {
  return `import { createFileRoute, notFound } from "@tanstack/react-router";
import { CollectionDetailView, getCollection } from "@voila/content/internal";
import content from "${configImport}";

export const Route = createFileRoute("/admin/collections/$collection/$id")({
  component: RouteComponent,
});

function RouteComponent() {
  const { collection: slug, id } = Route.useParams();
  const collection = getCollection(content, slug);
  if (!collection) throw notFound();
  return <CollectionDetailView config={content} collection={collection} id={id} />;
}
`;
}

export function adminSingletonSource(configImport: string): string {
  return `import { createFileRoute, notFound } from "@tanstack/react-router";
import { getSingleton, SingletonView } from "@voila/content/internal";
import content from "${configImport}";

export const Route = createFileRoute("/admin/singletons/$singleton")({
  component: RouteComponent,
});

function RouteComponent() {
  const { singleton: slug } = Route.useParams();
  const singleton = getSingleton(content, slug);
  if (!singleton) throw notFound();
  return <SingletonView config={content} singleton={singleton} />;
}
`;
}
