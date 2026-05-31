import { Result } from "@effect-atom/atom";
import { useAtomValue } from "@effect-atom/atom-react";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { CollectionForm } from "~/components/admin/collection-form";
import config from "~/content.config";
import { type AnyDoc, atomsFor } from "~/lib/admin";

export const Route = createFileRoute("/admin/$collection/$id/edit")({
  beforeLoad: ({ params }) => {
    if (!(params.collection in config.collections)) throw notFound();
  },
  component: EditDocumentPage,
});

function EditDocumentPage() {
  const { collection, id } = Route.useParams();
  const navigate = useNavigate();
  // biome-ignore lint/style/noNonNullAssertion: the route validated the slug.
  const atoms = atomsFor(collection)!;
  const result = useAtomValue(atoms.find(id));
  const meta = config.collections[collection as keyof typeof config.collections];

  if (!Result.isSuccess(result)) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit {meta?.label ?? collection}</h1>
      <CollectionForm
        slug={collection}
        id={id}
        initial={result.value as AnyDoc}
        onSaved={() => navigate({ to: "/admin/$collection/$id", params: { collection, id } })}
      />
    </div>
  );
}
