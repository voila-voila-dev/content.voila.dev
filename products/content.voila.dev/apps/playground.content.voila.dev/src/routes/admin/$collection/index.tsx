import { createFileRoute, notFound } from "@tanstack/react-router";
import { CollectionTable } from "~/components/admin/collection-table";
import config from "~/content.config";

export const Route = createFileRoute("/admin/$collection/")({
  beforeLoad: ({ params }) => {
    if (!(params.collection in config.collections)) throw notFound();
  },
  component: CollectionListPage,
});

function CollectionListPage() {
  const { collection } = Route.useParams();
  const meta = config.collections[collection as keyof typeof config.collections];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{meta?.label ?? collection}</h1>
      <CollectionTable slug={collection} />
    </div>
  );
}
