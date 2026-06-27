// The detail/edit screen for ANY collection: read view via `DetailView`, inline
// edit via `CollectionForm`, soft-delete via `ConfirmButton`. Mounted by the
// host's fixed `admin.$collection.$id.tsx` shim.

import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import { CollectionForm, ConfirmButton, DetailView, type Doc } from "@voila/content-ui";
import { type ReactNode, useState } from "react";
import { useAdmin } from "../context";
import { useCollectionMutations } from "../hooks/use-collection-mutations";
import { AdminLink } from "../lib/admin-link";
import { collectionClient } from "../lib/client-access";
import { errorMessage, fieldErrors } from "../lib/field-errors";
import { CustomScreenDispatcher } from "./custom-dispatcher";

export function CollectionDetailScreen(): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
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

  // The hook refreshes the doc + list caches; this screen owns the edit-mode and
  // navigation side-effects (per call).
  const { update, remove } = useCollectionMutations(slug);

  // Not a collection → a custom screen path caught by `$collection/$id`.
  if (!collection) return <CustomScreenDispatcher />;
  const label = collection.label ?? slug;

  if (editing && doc.data) {
    const serverErrors = fieldErrors(update.error);
    return (
      <CollectionForm
        collection={collection}
        registry={admin.editWidgets}
        locales={admin.config.i18n?.locales}
        defaultValues={doc.data}
        title={`Edit ${label}`}
        // Per-field (grouped) mode has no single Save to exit on, so offer an
        // explicit way back to the read view; an ungrouped save returns on its
        // own, so it just needs a Back to the list.
        actions={
          grouped ? (
            <>
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
            </>
          ) : (
            <button
              type="button"
              className="text-sm text-muted-foreground"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          )
        }
        error={!serverErrors ? errorMessage(update.error) : undefined}
        serverErrors={serverErrors}
        submitLabel="Save"
        activeGroup={activeGroup}
        onGroupChange={changeGroup}
        // Grouped collections save per field (each card patches its own field);
        // ungrouped ones keep the single whole-form Save. `api.update` is a
        // PATCH, so a one-field partial is safe.
        saveMode={grouped ? "field" : "form"}
        onSubmit={(values) =>
          update.mutate(
            { id, values: values as Doc },
            // Per-field (grouped) edits stay in edit mode so other cards' unsaved
            // edits aren't discarded; a whole-form (ungrouped) save returns to read.
            { onSuccess: grouped ? undefined : () => setEditing(false) },
          )
        }
      />
    );
  }

  return (
    <DetailView.Root
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
            onConfirm={() =>
              remove.mutate(id, {
                onSuccess: () => navigate({ href: `${admin.basePath}/${slug}` }),
              })
            }
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
