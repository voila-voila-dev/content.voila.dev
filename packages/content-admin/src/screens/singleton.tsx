// The single-document screen for a configured singleton (e.g. site settings).
// Reached via the shared `$collection` index route when the slug resolves to a
// singleton rather than a collection, and via `$collection/$id` where `$id` is
// a field-group id (`/settings/branding`) — sections are routes. Read view +
// inline edit; `set` upserts the one row. On desktop the group list lives in the
// sidebar (registered here); the header carries Edit, or Cancel/Save while
// editing.

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import {
  CollectionForm,
  DetailView,
  type Doc,
  PageLayout,
  resolveFieldGroups,
  useRegisterSidebarSection,
} from "@voila/content-ui";
import { Button } from "@voila.dev/ui/button";
import { type ReactNode, useState } from "react";
import { useAdmin } from "../context";
import { useSingletonMutations } from "../hooks/use-singleton-mutations";
import { AdminLink } from "../lib/admin-link";
import { backToHome } from "../lib/back";
import { singletonClient } from "../lib/client-access";
import { errorMessage, fieldErrors } from "../lib/field-errors";

export interface SingletonScreenProps {
  readonly slug: string;
  /** The active field group (a route segment), when the singleton declares groups. */
  readonly group?: string;
}

export function SingletonScreen({ slug, group }: SingletonScreenProps): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  // A singleton shares the runtime shape DetailView/CollectionForm read
  // (`slug`/`label`/`titleField`/`fields`/`groups`), so it stands in for `Collection`.
  const singleton = admin.config.singletons[slug] as unknown as Collection;
  const label = singleton.label ?? slug;
  const base = `${admin.basePath}/${slug}`;

  const groups = (singleton.groups?.length ?? 0) > 0 ? resolveFieldGroups(singleton) : [];
  const activeGroup = groups.find((g) => g.id === group)?.id ?? groups[0]?.id;
  function changeGroup(id: string) {
    void navigate({ href: `${base}/${id}`, replace: true });
  }

  // Desktop: the sections live in the sidebar while this screen is mounted.
  useRegisterSidebarSection(
    groups.length > 0
      ? {
          title: label,
          subtitle: "Settings",
          back: { href: backToHome(admin.basePath).href, label: "Overview" },
          items: groups.map((g) => ({
            id: g.id,
            label: g.label,
            href: `${base}/${g.id}`,
            icon: g.icon,
            isActive: g.id === activeGroup,
          })),
        }
      : null,
  );

  const api = singletonClient(admin.client, slug);
  const doc = useQuery({ queryKey: [slug, "singleton"], queryFn: () => api.get() });

  // The hook refreshes the singleton cache; this screen leaves edit mode per call.
  const { save } = useSingletonMutations(slug);

  const home = backToHome(admin.basePath);
  const back = (
    <PageLayout.Back
      href={home.href}
      label={home.label}
      renderLink={(href) => <AdminLink href={href} />}
    />
  );

  if (editing || (doc.isSuccess && doc.data === null)) {
    const serverErrors = fieldErrors(save.error);
    return (
      <CollectionForm
        collection={singleton}
        registry={admin.editWidgets}
        locales={admin.config.i18n?.locales}
        defaultValues={doc.data ?? undefined}
        title={doc.data ? `Edit ${label}` : label}
        back={back}
        // Only offer Cancel when there's an existing document to return to (a
        // not-yet-created singleton has nothing to read).
        actions={
          doc.data ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
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
      title={label}
      back={back}
      hideMeta
      activeGroup={activeGroup}
      onGroupChange={changeGroup}
      actions={
        <Button type="button" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      }
    />
  );
}
