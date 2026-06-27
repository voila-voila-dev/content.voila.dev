// The single-document screen for a configured singleton (e.g. site settings).
// Reached via the shared `$collection` index route when the slug resolves to a
// singleton rather than a collection. Read view + inline edit; `set` upserts the
// one row.

import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import { CollectionForm, DetailView, type Doc } from "@voila/content-ui";
import { type ReactNode, useState } from "react";
import { useAdmin } from "../context";
import { useSingletonMutations } from "../hooks/use-singleton-mutations";
import { singletonClient } from "../lib/client-access";
import { errorMessage, fieldErrors } from "../lib/field-errors";

export function SingletonScreen({ slug }: { readonly slug: string }): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  // A singleton shares the runtime shape DetailView/CollectionForm read
  // (`slug`/`label`/`titleField`/`fields`/`groups`), so it stands in for `Collection`.
  const singleton = admin.config.singletons[slug] as unknown as Collection;
  // Active field group in the URL (`?group=`), as on the collection detail page.
  const search = useSearch({ strict: false }) as { readonly group?: string };
  const activeGroup = search.group;
  function changeGroup(id: string) {
    navigate({
      to: ".",
      replace: true,
      search: (prev: Record<string, unknown>) => ({ ...prev, group: id }),
    });
  }

  const api = singletonClient(admin.client, slug);
  const doc = useQuery({ queryKey: [slug, "singleton"], queryFn: () => api.get() });

  // The hook refreshes the singleton cache; this screen leaves edit mode per call.
  const { save } = useSingletonMutations(slug);

  const label = singleton.label ?? slug;

  if (editing || (doc.isSuccess && doc.data === null)) {
    const serverErrors = fieldErrors(save.error);
    return (
      <CollectionForm
        collection={singleton}
        registry={admin.editWidgets}
        locales={admin.config.i18n?.locales}
        defaultValues={doc.data ?? undefined}
        title={`Edit ${label}`}
        // Only offer Cancel when there's an existing document to return to (a
        // not-yet-created singleton has nothing to read).
        actions={
          doc.data ? (
            <button
              type="button"
              className="text-sm text-muted-foreground"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          ) : undefined
        }
        error={!serverErrors ? errorMessage(save.error) : undefined}
        serverErrors={serverErrors}
        submitLabel="Save"
        activeGroup={activeGroup}
        onGroupChange={changeGroup}
        onSubmit={(values) => save.mutate(values as Doc, { onSuccess: () => setEditing(false) })}
      />
    );
  }

  return (
    <DetailView.Root
      collection={singleton}
      doc={doc.data}
      registry={admin.displayWidgets}
      loading={doc.isLoading}
      error={errorMessage(doc.error)}
      emptyMessage={`No ${label} yet.`}
      activeGroup={activeGroup}
      onGroupChange={changeGroup}
      actions={
        <button
          type="button"
          className="text-sm font-medium text-primary"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      }
    />
  );
}
