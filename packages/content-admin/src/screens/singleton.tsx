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
  formWidthFor,
  PageLayout,
  resolveFieldGroups,
  useMessages,
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
import { PreviewSplit, usePreviewAvailable, usePreviewToggle } from "./preview-split";
import { PreviewToggle } from "./preview-toggle";

export interface SingletonScreenProps {
  readonly slug: string;
  /** The active field group (a route segment), when the singleton declares groups. */
  readonly group?: string;
}

export function SingletonScreen({ slug, group }: SingletonScreenProps): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const { admin: m, common } = useMessages();
  // Live preview of the singleton (a settings page, a home page as one record).
  const previewTarget = admin.preview[slug];
  const previewAvailable = usePreviewAvailable(previewTarget);
  const preview = usePreviewToggle(slug);
  const previewToggle = previewAvailable ? (
    <PreviewToggle open={preview.open} onOpenChange={preview.setOpen} />
  ) : null;
  const [liveValues, setLiveValues] = useState<Doc | null>(null);
  // A singleton shares the runtime shape DetailView/CollectionForm read
  // (`slug`/`label`/`titleField`/`fields`/`groups`), so it stands in for `Collection`.
  const singleton = admin.config.singletons[slug] as unknown as Collection;
  const label = singleton.label ?? slug;
  const base = `${admin.basePath}/${slug}`;

  const groups =
    (singleton.groups?.length ?? 0) > 0
      ? resolveFieldGroups(singleton, { generalLabel: admin.messages.shell.generalGroup })
      : [];
  const activeGroup = groups.find((g) => g.id === group)?.id ?? groups[0]?.id;
  function changeGroup(id: string) {
    void navigate({ href: `${base}/${id}`, replace: true });
  }

  // Desktop: the sections live in the sidebar while this screen is mounted.
  useRegisterSidebarSection(
    groups.length > 0
      ? {
          title: label,
          subtitle: m.settings,
          back: { href: backToHome(admin.basePath, m).href, label: m.overview },
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

  const home = backToHome(admin.basePath, m);
  const back = (
    <PageLayout.Back
      href={home.href}
      label={home.label}
      renderLink={(href) => <AdminLink href={href} />}
    />
  );

  if (editing || (doc.isSuccess && doc.data === null)) {
    const serverErrors = fieldErrors(save.error);
    const form = (
      <CollectionForm
        collection={singleton}
        registry={admin.editWidgets}
        locales={admin.config.i18n?.locales}
        defaultValues={doc.data ?? undefined}
        title={doc.data ? m.editTitle(label) : label}
        back={back}
        // Only offer Cancel when there's an existing document to return to (a
        // not-yet-created singleton has nothing to read).
        actions={
          <>
            {previewToggle}
            {doc.data ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                {common.cancel}
              </Button>
            ) : null}
          </>
        }
        error={!serverErrors ? errorMessage(save.error) : undefined}
        serverErrors={serverErrors}
        submitLabel={common.save}
        activeGroup={activeGroup}
        onGroupChange={changeGroup}
        width={formWidthFor(singleton.fields, groups.find((g) => g.id === activeGroup)?.fieldKeys)}
        onSubmit={(values) => save.mutate(values as Doc, { onSuccess: () => setEditing(false) })}
        onValuesChange={previewTarget ? setLiveValues : undefined}
      />
    );
    return previewAvailable && previewTarget ? (
      <PreviewSplit
        slug={slug}
        target={previewTarget}
        open={preview.open}
        doc={liveValues ?? doc.data ?? {}}
      >
        {form}
      </PreviewSplit>
    ) : (
      form
    );
  }

  const view = (
    <DetailView.Root
      collection={singleton}
      doc={doc.data}
      registry={admin.displayWidgets}
      loading={doc.isLoading}
      error={errorMessage(doc.error)}
      emptyMessage={m.nothingYet(label)}
      title={label}
      back={back}
      hideMeta
      activeGroup={activeGroup}
      onGroupChange={changeGroup}
      actions={
        <>
          {previewToggle}
          <Button type="button" size="sm" onClick={() => setEditing(true)}>
            {common.edit}
          </Button>
        </>
      }
    />
  );
  return previewAvailable && previewTarget && doc.data ? (
    <PreviewSplit slug={slug} target={previewTarget} open={preview.open} doc={doc.data}>
      {view}
    </PreviewSplit>
  ) : (
    view
  );
}
