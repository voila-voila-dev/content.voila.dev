// The single-document screen for a configured singleton (e.g. site settings).
// Reached via the shared `$collection` index route when the slug resolves to a
// singleton rather than a collection. Read view + inline edit; `set` upserts the
// one row.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Collection } from "@voila/content";
import { CollectionForm, DetailView, type Doc } from "@voila/content-ui";
import { type ReactNode, useState } from "react";
import { useAdmin } from "../context";
import { singletonClient } from "../lib/client-access";
import { errorMessage, fieldErrors } from "../lib/field-errors";

export function SingletonScreen({ slug }: { readonly slug: string }): ReactNode {
  const { admin } = useAdmin();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  // A singleton shares the runtime shape DetailView/CollectionForm read
  // (`slug`/`label`/`titleField`/`fields`), so it stands in for `Collection`.
  const singleton = admin.config.singletons[slug] as unknown as Collection;

  const api = singletonClient(admin.client, slug);
  const doc = useQuery({ queryKey: [slug, "singleton"], queryFn: () => api.get() });

  const save = useMutation({
    mutationFn: (values: Doc) => api.set(values),
    onSuccess: (updated) => {
      queryClient.setQueryData([slug, "singleton"], updated);
      setEditing(false);
    },
  });

  const label = singleton.label ?? slug;

  if (editing || (doc.isSuccess && doc.data === null)) {
    const serverErrors = fieldErrors(save.error);
    return (
      <section className="max-w-xl space-y-4">
        <h1 className="text-lg font-semibold">Edit {label}</h1>
        <CollectionForm
          collection={singleton}
          registry={admin.editWidgets}
          locales={admin.config.i18n?.locales}
          defaultValues={doc.data ?? undefined}
          error={!serverErrors ? errorMessage(save.error) : undefined}
          serverErrors={serverErrors}
          submitLabel="Save"
          onSubmit={(values) => save.mutate(values as Doc)}
        />
      </section>
    );
  }

  return (
    <DetailView
      collection={singleton}
      doc={doc.data}
      registry={admin.displayWidgets}
      loading={doc.isLoading}
      error={errorMessage(doc.error)}
      emptyMessage={`No ${label} yet.`}
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
