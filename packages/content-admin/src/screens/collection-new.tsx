// The create screen for ANY collection. Schema-driven `CollectionForm` titled
// "New <singular>", with Create in the header action bar; a failed write
// surfaces per-field errors inline (see `fieldErrors`). Mounted by the host's
// fixed `_app.$collection.new.tsx` shim.

import { useNavigate, useParams } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import { CollectionForm, type Doc, PageLayout, singularLabel } from "@voila/content-ui";
import { Button } from "@voila.dev/ui/button";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { useCollectionMutations } from "../hooks/use-collection-mutations";
import { AdminLink } from "../lib/admin-link";
import { backToList } from "../lib/back";
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
  const back = backToList(admin.basePath, slug, label);

  return (
    <CollectionForm
      collection={collection}
      registry={admin.editWidgets}
      locales={admin.config.i18n?.locales}
      title={`New ${singularLabel(collection).toLowerCase()}`}
      back={
        <PageLayout.Back
          href={back.href}
          label={back.label}
          renderLink={(href) => <AdminLink href={href} />}
        />
      }
      actions={
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<AdminLink href={back.href} />}
        >
          Cancel
        </Button>
      }
      error={!serverErrors ? errorMessage(create.error) : undefined}
      serverErrors={serverErrors}
      submitLabel="Create"
      onSubmit={(values) =>
        create.mutate(values as Doc, {
          onSuccess: (doc) => navigate({ href: `${admin.basePath}/${slug}/${doc.id}` }),
        })
      }
    />
  );
}
