/**
 * Source generators for the read-only admin view routes:
 *
 *   /admin/collections/$collection          → list view
 *   /admin/collections/$collection/$id      → detail view
 *   /admin/singletons/$singleton            → singleton view
 *
 * Each file declares a TanStack route whose `loader` calls
 * `queryClient.ensureQueryData` to prefetch the read endpoint, and a component
 * that calls `useSuspenseQuery` on the same key — so SSR hands fully-resolved
 * data to the client without a render-blocking fetch, and there's no skeleton
 * flash on first paint. The route's `pendingComponent` renders the loading
 * skeleton during slow client-side navigations instead.
 *
 * The router is expected to expose a `queryClient` on its context via
 * `setupRouterSsrQueryIntegration` (wired in the playground's router.tsx).
 *
 * `apiBase()` resolves the read-endpoint origin isomorphically: relative on the
 * client (where `fetch("/admin/api/…")` resolves against the page), absolute on
 * the server (relative URLs have no origin during SSR). The server-only branch
 * is behind `import.meta.env.SSR`, so Vite tree-shakes the
 * `@tanstack/react-start/server` import out of the client bundle.
 */

const SEARCH_SCHEMA = `(search: Record<string, unknown>): { cursor?: string; orderBy?: string; order?: "asc" | "desc" } => {
  const cursor = typeof search.cursor === "string" ? search.cursor : undefined;
  const orderBy = typeof search.orderBy === "string" ? search.orderBy : undefined;
  const order: "asc" | "desc" | undefined =
    search.order === "asc" ? "asc" : search.order === "desc" ? "desc" : undefined;
  return { cursor, orderBy, order };
}`;

const API_BASE = `async function apiBase(): Promise<string> {
  if (import.meta.env.SSR) {
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    return new URL(content.mount.api, getRequestUrl().origin).toString();
  }
  return content.mount.api;
}`;

export function adminCollectionListSource(configImport: string): string {
  return `import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  CollectionListView,
  getCollection,
  ListSkeleton,
  listQueryOptions,
  PageLayout,
} from "@voila/content/internal";
import content from "${configImport}";

${API_BASE}

export const Route = createFileRoute("/admin/collections/$collection/")({
  validateSearch: ${SEARCH_SCHEMA},
  loaderDeps: ({ search }) => ({
    cursor: search.cursor,
    orderBy: search.orderBy,
    order: search.order,
  }),
  loader: async ({ context, params, deps }) => {
    const collection = getCollection(content, params.collection);
    if (!collection) throw notFound();
    await context.queryClient.ensureQueryData(
      listQueryOptions(await apiBase(), collection.slug, {
        cursor: deps.cursor ?? null,
        orderBy: deps.orderBy,
        order: deps.order,
      }),
    );
  },
  pendingComponent: () => (
    <PageLayout.Root>
      <PageLayout.Body>
        <ListSkeleton />
      </PageLayout.Body>
    </PageLayout.Root>
  ),
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
import {
  CollectionDetailView,
  DetailSkeleton,
  detailQueryOptions,
  getCollection,
  PageLayout,
} from "@voila/content/internal";
import content from "${configImport}";

${API_BASE}

export const Route = createFileRoute("/admin/collections/$collection/$id")({
  loader: async ({ context, params }) => {
    const collection = getCollection(content, params.collection);
    if (!collection) throw notFound();
    await context.queryClient.ensureQueryData(
      detailQueryOptions(await apiBase(), collection.slug, params.id),
    );
  },
  pendingComponent: () => (
    <PageLayout.Root>
      <PageLayout.Body>
        <DetailSkeleton />
      </PageLayout.Body>
    </PageLayout.Root>
  ),
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
import {
  DetailSkeleton,
  getSingleton,
  PageLayout,
  singletonQueryOptions,
  SingletonView,
} from "@voila/content/internal";
import content from "${configImport}";

${API_BASE}

export const Route = createFileRoute("/admin/singletons/$singleton")({
  loader: async ({ context, params }) => {
    const singleton = getSingleton(content, params.singleton);
    if (!singleton) throw notFound();
    await context.queryClient.ensureQueryData(
      singletonQueryOptions(await apiBase(), singleton.slug),
    );
  },
  pendingComponent: () => (
    <PageLayout.Root>
      <PageLayout.Body>
        <DetailSkeleton />
      </PageLayout.Body>
    </PageLayout.Root>
  ),
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
