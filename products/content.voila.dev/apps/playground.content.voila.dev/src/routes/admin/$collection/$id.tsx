import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CollectionDetail } from "~/components/admin/collection-detail";
import config from "~/content.config";

export const Route = createFileRoute("/admin/$collection/$id")({
  beforeLoad: ({ params }) => {
    if (!(params.collection in config.collections)) throw notFound();
  },
  component: CollectionDetailPage,
});

function CollectionDetailPage() {
  const { collection, id } = Route.useParams();
  const meta = config.collections[collection as keyof typeof config.collections];
  return (
    <div className="space-y-4">
      <Link
        to="/admin/$collection"
        params={{ collection }}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {meta?.label ?? collection}
      </Link>
      <CollectionDetail slug={collection} id={id} />
    </div>
  );
}
