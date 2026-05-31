import { HydrationBoundary } from "@effect-atom/atom-react/ReactHydration";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CollectionTable } from "~/components/admin/collection-table";
import { Button } from "~/components/ui/button";
import config from "~/content.config";
import { type DehydratedAtoms, parseDehydrated, prefetchCollectionList } from "~/lib/voila-ssr";

export const Route = createFileRoute("/admin/$collection/")({
  beforeLoad: ({ params }) => {
    if (!(params.collection in config.collections)) throw notFound();
  },
  // On the server-rendered request, prefetch the first page with the visitor's
  // cookie forwarded and ship the dehydrated atom in the payload. On client-side
  // navigation there is nothing to hydrate — the atom fetches itself.
  loader: async ({ params }): Promise<{ dehydrated: DehydratedAtoms }> => {
    if (typeof document !== "undefined") return { dehydrated: [] };
    const payload = await prefetchCollectionList({ data: { slug: params.collection, limit: 50 } });
    return { dehydrated: parseDehydrated(payload) };
  },
  component: CollectionListPage,
});

function CollectionListPage() {
  const { collection } = Route.useParams();
  const { dehydrated } = Route.useLoaderData();
  const meta = config.collections[collection as keyof typeof config.collections];
  return (
    <HydrationBoundary state={dehydrated}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{meta?.label ?? collection}</h1>
          <Link to="/admin/$collection/new" params={{ collection }}>
            <Button>New</Button>
          </Link>
        </div>
        <CollectionTable slug={collection} />
      </div>
    </HydrationBoundary>
  );
}
