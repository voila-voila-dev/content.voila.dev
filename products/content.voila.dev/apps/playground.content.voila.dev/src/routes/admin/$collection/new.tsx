import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { CollectionForm } from "~/components/admin/collection-form";
import config from "~/content.config";

export const Route = createFileRoute("/admin/$collection/new")({
  beforeLoad: ({ params }) => {
    if (!(params.collection in config.collections)) throw notFound();
  },
  component: NewDocumentPage,
});

function NewDocumentPage() {
  const { collection } = Route.useParams();
  const navigate = useNavigate();
  const meta = config.collections[collection as keyof typeof config.collections];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New {meta?.label ?? collection}</h1>
      <CollectionForm
        slug={collection}
        onSaved={(doc) =>
          navigate({ to: "/admin/$collection/$id", params: { collection, id: doc.id } })
        }
      />
    </div>
  );
}
