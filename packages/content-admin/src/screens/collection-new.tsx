// The create screen for ANY collection. Schema-driven `CollectionForm` titled
// "New <singular>", with Create in the header action bar; a failed write
// surfaces per-field errors inline (see `fieldErrors`). Mounted by the host's
// fixed `_app.$collection.new.tsx` shim.
//
// Two things differ from the edit screen on purpose. Groups render STACKED
// (`groupLayout="all"`): a new record has no group nav to route through, so
// hiding groups behind one would leave most of a collection's fields
// unreachable until after the first save. And navigating away with typed but
// unsaved input asks first (`useUnsavedGuard`) — Cancel used to discard silently.

import { useNavigate, useParams } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import {
  CollectionForm,
  collectionOperations,
  type Doc,
  PageLayout,
  singularLabel,
  useMessages,
} from "@voila/content-ui";
import { Button } from "@voila.dev/ui/button";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { useCollectionMutations } from "../hooks/use-collection-mutations";
import { useUnsavedGuard } from "../hooks/use-unsaved-guard";
import { AdminLink } from "../lib/admin-link";
import { backToList } from "../lib/back";
import { errorMessage, fieldErrors } from "../lib/field-errors";
import { CustomScreenDispatcher, NotFoundScreen } from "./custom-dispatcher";

export function CollectionNewScreen(): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const { collection: slug } = useParams({ strict: false }) as { collection: string };
  const collection = admin.config.collections[slug] as Collection | undefined;

  const { admin: m, common } = useMessages();
  const { create } = useCollectionMutations(slug);
  const guard = useUnsavedGuard({
    label: collection ? singularLabel(collection).toLowerCase() : undefined,
  });

  if (!collection) return <CustomScreenDispatcher />;
  // A collection with `operations.create: false` has no create page: the list
  // never links here, and a typed URL gets the same 404 an unknown path does.
  if (!collectionOperations(collection).create) return <NotFoundScreen />;

  const serverErrors = fieldErrors(create.error);
  const label = collection.label ?? slug;
  const back = backToList(admin.basePath, slug, label, m);

  return (
    <>
      {guard.dialog}
      <CollectionForm
        collection={collection}
        registry={admin.editWidgets}
        displayRegistry={admin.displayWidgets}
        locales={admin.config.i18n?.locales}
        defaultLocale={admin.config.i18n?.defaultLocale}
        groupLayout="all"
        onDirtyChange={guard.setDirty}
        title={m.newTitle(singularLabel(collection).toLowerCase())}
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
            {common.cancel}
          </Button>
        }
        error={!serverErrors ? errorMessage(create.error) : undefined}
        serverErrors={serverErrors}
        submitLabel={common.create}
        onSubmit={(values) =>
          create.mutate(values as Doc, {
            onSuccess: (doc) => navigate({ href: `${admin.basePath}/${slug}/${doc.id}` }),
          })
        }
      />
    </>
  );
}
