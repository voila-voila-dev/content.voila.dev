// The detail/edit screen for ANY collection: read view via `DetailView`, inline
// edit via `CollectionForm`, soft-delete via `ConfirmButton`. Mounted by the
// host's fixed `admin.$collection.$id.tsx` shim.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
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
  // Grouped collections edit per field (each card saves itself); ungrouped ones
  // use a single whole-form Save. A grouped collection's form/read view also lays
  // out a sub-nav beside a card, so it wants the full width.
  const grouped = (collection?.groups?.length ?? 0) > 0;
  const [editing, setEditing] = useState(false);
  // The active field group (when the collection declares `groups`) lives in the
  // URL as `?group=`, so it survives reloads and the read⇄edit toggle. Read
  // loosely (the route doesn't validate it) and update it in place.
  const search = useSearch({ strict: false }) as { readonly group?: string };
  const activeGroup = search.group;
  function changeGroup(id: string) {
    navigate({
      to: ".",
      replace: true,
      search: (prev: Record<string, unknown>) => ({ ...prev, group: id }),
    });
  }

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
      // Per-field (grouped) edits stay in edit mode so the user can save other
      // cards too — exiting would discard their unsaved edits. A whole-form
      // (ungrouped) save persists everything, so it returns to the read view.
      if (!grouped) setEditing(false);
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
      <section className={grouped ? "space-y-4" : "max-w-xl space-y-4"}>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Edit {label}</h1>
          {/* Per-field mode has no single Save to exit on, so offer an explicit
              way back to the read view (and the list). */}
          {grouped ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-sm font-medium text-primary"
                onClick={() => setEditing(false)}
              >
                Done
              </button>
              <AdminLink
                href={`${admin.basePath}/${slug}`}
                className="text-sm text-muted-foreground"
              >
                Back
              </AdminLink>
            </div>
          ) : null}
        </div>
        <CollectionForm
          collection={collection}
          registry={admin.editWidgets}
          locales={admin.config.i18n?.locales}
          defaultValues={doc.data}
          error={!serverErrors ? errorMessage(update.error) : undefined}
          serverErrors={serverErrors}
          submitLabel="Save"
          activeGroup={activeGroup}
          onGroupChange={changeGroup}
          // Grouped collections save per field (each card patches its own field);
          // ungrouped ones keep the single whole-form Save. `api.update` is a
          // PATCH, so a one-field partial is safe.
          saveMode={grouped ? "field" : "form"}
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
      activeGroup={activeGroup}
      onGroupChange={changeGroup}
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
