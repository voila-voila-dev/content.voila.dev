// The detail/edit screen for ANY collection: read view via `DetailView`, inline
// edit via `CollectionForm`, soft-delete via `ConfirmButton`. Mounted by the
// host's fixed `admin.$collection.$id.tsx` shim.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import { CollectionForm, ConfirmButton, DetailView, type Doc } from "@voila/content-ui";
import { type ReactNode, useState } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { collectionClient } from "../lib/client-access";
import { errorMessage, fieldErrors } from "../lib/field-errors";
import { CustomScreenDispatcher } from "./custom-dispatcher";

export function CollectionDetailScreen(): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { collection: slug, id } = useParams({ strict: false }) as {
    collection: string;
    id: string;
  };
  const collection = admin.config.collections[slug] as Collection | undefined;
  const [editing, setEditing] = useState(false);

  const api = collectionClient(admin.client, slug);
  const doc = useQuery({
    queryKey: [slug, id],
    queryFn: () => api.find(id),
    enabled: collection !== undefined,
  });

  const update = useMutation({
    mutationFn: (values: Doc) => api.update(id, values),
    onSuccess: (updated) => {
      queryClient.setQueryData([slug, id], updated);
      queryClient.invalidateQueries({ queryKey: [slug, "list"] });
      setEditing(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [slug, "list"] });
      navigate({ href: `${admin.basePath}/${slug}` });
    },
  });

  // Not a collection → a custom screen path caught by `$collection/$id`.
  if (!collection) return <CustomScreenDispatcher />;
  const label = collection.label ?? slug;

  if (editing && doc.data) {
    const serverErrors = fieldErrors(update.error);
    return (
      <section className="max-w-xl space-y-4">
        <h1 className="text-lg font-semibold">Edit {label}</h1>
        <CollectionForm
          collection={collection}
          registry={admin.editWidgets}
          locales={admin.config.i18n?.locales}
          defaultValues={doc.data}
          error={!serverErrors ? errorMessage(update.error) : undefined}
          serverErrors={serverErrors}
          submitLabel="Save"
          onSubmit={(values) => update.mutate(values as Doc)}
        />
      </section>
    );
  }

  return (
    <DetailView
      collection={collection}
      doc={doc.data}
      registry={admin.displayWidgets}
      loading={doc.isLoading}
      error={errorMessage(doc.error)}
      emptyMessage="Not found."
      actions={
        <div className="flex items-center gap-3">
          {admin.slots.collection?.detailActions?.({ slug, id, client: admin.client })}
          <button
            type="button"
            className="text-sm font-medium text-primary"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <ConfirmButton
            onConfirm={() => remove.mutate()}
            disabled={remove.isPending}
            title={`Delete this ${label}?`}
            description="It's a soft delete — the record is hidden but recoverable through the API."
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </ConfirmButton>
          <AdminLink href={`${admin.basePath}/${slug}`} className="text-sm text-muted-foreground">
            Back
          </AdminLink>
        </div>
      }
    />
  );
}
