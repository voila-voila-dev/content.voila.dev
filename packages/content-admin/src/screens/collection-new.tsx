// The create screen for ANY collection. Schema-driven `CollectionForm`; a failed
// write surfaces per-field errors inline (see `fieldErrors`). Mounted by the
// host's fixed `admin.$collection.new.tsx` shim.

import { useNavigate, useParams } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import { CollectionForm, type Doc } from "@voila/content-ui";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { useCollectionMutations } from "../hooks/use-collection-mutations";
import { errorMessage, fieldErrors } from "../lib/field-errors";
import { CustomScreenDispatcher } from "./custom-dispatcher";

export function CollectionNewScreen(): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const { collection: slug } = useParams({ strict: false }) as { collection: string };
  const collection = admin.config.collections[slug] as Collection | undefined;

  const { create } = useCollectionMutations(slug);

  if (!collection) return <CustomScreenDispatcher />;

  const serverErrors = fieldErrors(create.error);
  const label = collection.label ?? slug;

  return (
    <section className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold">New {label}</h1>
      <CollectionForm
        collection={collection}
        registry={admin.editWidgets}
        locales={admin.config.i18n?.locales}
        error={!serverErrors ? errorMessage(create.error) : undefined}
        serverErrors={serverErrors}
        submitLabel="Create"
        onSubmit={(values) =>
          create.mutate(values as Doc, {
            onSuccess: (doc) => navigate({ href: `${admin.basePath}/${slug}/${doc.id}` }),
          })
        }
      />
    </section>
  );
}
