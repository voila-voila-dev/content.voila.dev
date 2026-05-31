import { HydrationBoundary } from "@effect-atom/atom-react/ReactHydration";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CollectionDetail } from "~/components/admin/collection-detail";
import { DocumentActions } from "~/components/admin/document-actions";
import config from "~/content.config";
import { type DehydratedAtoms, parseDehydrated, prefetchDocument } from "~/lib/voila-ssr";

export const Route = createFileRoute("/admin/$collection/$id")({
  beforeLoad: ({ params }) => {
    if (!(params.collection in config.collections)) throw notFound();
  },
  // SSR-only document prefetch (cookie forwarded); hydrates the `find` atom so the
  // detail view paints without a second fetch. Client navigation hydrates nothing.
  loader: async ({ params }): Promise<{ dehydrated: DehydratedAtoms }> => {
    if (typeof document !== "undefined") return { dehydrated: [] };
    const payload = await prefetchDocument({ data: { slug: params.collection, id: params.id } });
    return { dehydrated: parseDehydrated(payload) };
  },
  component: CollectionDetailPage,
});

function CollectionDetailPage() {
  const { collection, id } = Route.useParams();
  const { dehydrated } = Route.useLoaderData();
  const meta = config.collections[collection as keyof typeof config.collections];
  return (
    <HydrationBoundary state={dehydrated}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link
            to="/admin/$collection"
            params={{ collection }}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← {meta?.label ?? collection}
          </Link>
          <DocumentActions slug={collection} id={id} />
        </div>
        <CollectionDetail slug={collection} id={id} />
      </div>
    </HydrationBoundary>
  );
}
