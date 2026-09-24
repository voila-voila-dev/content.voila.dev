// The detail/edit screen for ANY collection: read view via `DetailView`, inline
// edit via `CollectionForm`, soft-delete from the header's overflow menu, plus
// publish controls (draft-enabled collections) and version history
// (`revisions: true`). Mounted by the host's fixed `_app.$collection.$id.tsx`
// shim AND its `$id.$group.tsx` child — field groups are routes
// (`/posts/123/content`), and the group list swaps into the sidebar while this
// screen is mounted (`useRegisterSidebarSection`). A singleton slug under
// `$collection/$id` means `$id` is the singleton's group (`/settings/branding`).

import { DotsThreeIcon, TrashIcon } from "@phosphor-icons/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import {
  CollectionForm,
  collectionOperations,
  DetailView,
  type Doc,
  documentTitle,
  type FocusPath,
  formWidthFor,
  PageLayout,
  PublishControls,
  RevisionHistory,
  resolveFieldGroups,
  singularLabel,
  useI18n,
  useMessages,
  useRegisterSidebarSection,
} from "@voila/content-ui";
import { AlertDialog } from "@voila.dev/ui/alert-dialog";
import { Button } from "@voila.dev/ui/button";
import { DropdownMenu } from "@voila.dev/ui/dropdown-menu";
import { type ReactNode, useState } from "react";
import { useAdmin } from "../context";
import { useCollectionMutations } from "../hooks/use-collection-mutations";
import { useUnsavedGuard } from "../hooks/use-unsaved-guard";
import { AdminLink } from "../lib/admin-link";
import { backToList } from "../lib/back";
import { collectionClient } from "../lib/client-access";
import { errorMessage, fieldErrors } from "../lib/field-errors";
import { CustomScreenDispatcher } from "./custom-dispatcher";
import { PreviewSplit, usePreviewAvailable, usePreviewToggle } from "./preview-split";
import { PreviewToggle } from "./preview-toggle";
import { RecordPager } from "./record-pager";
import { SingletonScreen } from "./singleton";
import { StatusControl } from "./status-control";

/** The reserved section id for version history (never a field group id). */
const HISTORY_SECTION = "history";

export function CollectionDetailScreen(): ReactNode {
  const { admin } = useAdmin();
  const params = useParams({ strict: false }) as {
    collection: string;
    id: string;
    group?: string;
  };
  const isSingleton = admin.config.singletons[params.collection] !== undefined;
  if (isSingleton) return <SingletonScreen slug={params.collection} group={params.id} />;
  const collection = admin.config.collections[params.collection] as Collection | undefined;
  // Not a collection → a custom screen path caught by `$collection/$id`.
  if (!collection) return <CustomScreenDispatcher />;
  return (
    <CollectionDocument
      collection={collection}
      slug={params.collection}
      id={params.id}
      group={params.group}
    />
  );
}

function CollectionDocument({
  collection,
  slug,
  id,
  group,
}: {
  readonly collection: Collection;
  readonly slug: string;
  readonly id: string;
  readonly group?: string;
}): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const i18n = useI18n();
  const { admin: m, common } = useMessages();
  const [editing, setEditing] = useState(false);
  // Live preview: the form's current values (unsaved edits included) and the
  // nested row the editor has open, relayed to the pane beside the document.
  const previewTarget = admin.preview[slug];
  const previewAvailable = usePreviewAvailable(previewTarget);
  const preview = usePreviewToggle(slug);
  const previewToggle = previewAvailable ? (
    <PreviewToggle open={preview.open} onOpenChange={preview.setOpen} />
  ) : null;
  const [liveValues, setLiveValues] = useState<Doc | null>(null);
  const [focusPath, setFocusPath] = useState<FocusPath | null>(null);
  const label = collection.label ?? slug;
  const singular = singularLabel(collection);
  // Which writes the collection offers; anything off is hidden here and
  // answered 405 by the REST layer anyway.
  const ops = collectionOperations(collection);
  // Grouped collections save per field, so a blocked navigation there has no
  // single Save to offer — only Discard / Keep editing.
  const guard = useUnsavedGuard({ label: singular.toLowerCase() });
  const listBack = backToList(admin.basePath, slug, label, m);
  const docBase = `${admin.basePath}/${slug}/${id}`;

  // Grouped collections edit per field (each field saves itself); ungrouped ones
  // use a single whole-form Save.
  const grouped = (collection.groups?.length ?? 0) > 0;
  const groups = grouped
    ? resolveFieldGroups(collection, { generalLabel: admin.messages.shell.generalGroup })
    : [];
  const showHistory = collection.revisions === true;
  const historyActive = group === HISTORY_SECTION && showHistory;
  const activeGroup = groups.find((g) => g.id === group)?.id ?? groups[0]?.id;
  function changeGroup(next: string) {
    void navigate({ href: `${docBase}/${next}`, replace: true });
  }

  const api = collectionClient(admin.client, slug);
  const doc = useQuery({ queryKey: [slug, id], queryFn: () => api.find(id) });
  const title = doc.data ? (documentTitle(collection, doc.data, i18n) ?? singular) : singular;

  // Desktop: swap the sidebar to this document's sections while mounted.
  useRegisterSidebarSection(
    grouped || showHistory
      ? {
          title,
          subtitle: label,
          back: { href: listBack.href, label },
          items: [
            ...groups.map((g) => ({
              id: g.id,
              label: g.label,
              href: `${docBase}/${g.id}`,
              icon: g.icon,
              isActive: !historyActive && g.id === activeGroup,
            })),
            ...(showHistory
              ? [
                  {
                    id: HISTORY_SECTION,
                    label: m.history,
                    href: `${docBase}/${HISTORY_SECTION}`,
                    icon: "ClockCounterClockwise",
                    isActive: historyActive,
                  },
                ]
              : []),
          ],
        }
      : null,
  );

  // The hook refreshes the doc + list caches; this screen owns the edit-mode and
  // navigation side-effects (per call).
  const { update, remove, publish, unpublish, restoreRevision } = useCollectionMutations(slug);

  const back = (
    <PageLayout.Back
      href={listBack.href}
      label={listBack.label}
      renderLink={(href) => <AdminLink href={href} />}
    />
  );

  if (historyActive) {
    return (
      <HistorySection
        slug={slug}
        id={id}
        title={title}
        back={back}
        // Restoring a revision writes the document, so it follows `update`.
        onRestore={ops.update ? (rev) => restoreRevision.mutate({ id, rev }) : undefined}
        restoring={restoreRevision.isPending}
      />
    );
  }

  if (editing && ops.update && doc.data) {
    const serverErrors = fieldErrors(update.error);
    const form = (
      <CollectionForm
        collection={collection}
        registry={admin.editWidgets}
        locales={admin.config.i18n?.locales}
        defaultLocale={admin.config.i18n?.defaultLocale}
        onDirtyChange={guard.setDirty}
        defaultValues={doc.data}
        title={m.editTitle(title)}
        back={back}
        // Per-field (grouped) mode has no single Save to exit on, so Done returns
        // to the read view; a whole-form save returns on its own, so it just
        // needs Cancel.
        actions={
          <>
            {previewToggle}
            <Button
              type="button"
              variant={grouped ? "default" : "ghost"}
              size="sm"
              onClick={() => setEditing(false)}
            >
              {grouped ? m.done : common.cancel}
            </Button>
          </>
        }
        error={!serverErrors ? errorMessage(update.error) : undefined}
        serverErrors={serverErrors}
        submitLabel={common.save}
        activeGroup={activeGroup}
        onGroupChange={changeGroup}
        // Structured fields (blocks, arrays, objects) nest rows that need
        // the wider column; a plain scalar group keeps the reading measure.
        width={formWidthFor(collection.fields, groups.find((g) => g.id === activeGroup)?.fieldKeys)}
        // Grouped collections save per field (each field patches itself);
        // ungrouped ones keep the single whole-form Save. `api.update` is a
        // PATCH, so a one-field partial is safe.
        saveMode={grouped ? "field" : "form"}
        onSubmit={(values) =>
          update.mutate(
            { id, values: values as Doc },
            // Per-field (grouped) edits stay in edit mode so other fields'
            // unsaved edits aren't discarded; a whole-form save returns to read.
            { onSuccess: grouped ? undefined : () => setEditing(false) },
          )
        }
        onValuesChange={previewTarget ? setLiveValues : undefined}
        onFocusPathChange={previewTarget ? setFocusPath : undefined}
      />
    );
    return (
      <>
        {guard.dialog}
        {previewAvailable && previewTarget ? (
          <PreviewSplit
            slug={slug}
            target={previewTarget}
            open={preview.open}
            doc={liveValues ?? doc.data}
            focus={focusPath}
          >
            {form}
          </PreviewSplit>
        ) : (
          form
        )}
      </>
    );
  }

  const view = (
    <DetailView.Root
      collection={collection}
      doc={doc.data}
      registry={admin.displayWidgets}
      loading={doc.isLoading}
      error={errorMessage(doc.error)}
      emptyMessage={m.notFoundShort}
      back={back}
      activeGroup={activeGroup}
      onGroupChange={changeGroup}
      aside={
        collection.drafts === true && ops.update && doc.data ? (
          <PublishControls
            doc={doc.data}
            onPublish={() => publish.mutate(id)}
            onUnpublish={() => unpublish.mutate(id)}
            disabled={publish.isPending || unpublish.isPending}
          />
        ) : undefined
      }
      actions={
        <>
          {/* Move between records without a round trip through the list. */}
          <RecordPager slug={slug} id={id} keyboard={!editing} />
          {/* The record's editorial state, changeable in one click — it used to
              be reachable only through Edit mode and a field group. */}
          {doc.data && ops.update && collection.drafts !== true ? (
            <StatusControl
              collection={collection}
              doc={doc.data}
              disabled={update.isPending}
              onChange={(values) => update.mutate({ id, values })}
            />
          ) : null}
          {admin.slots.collection?.detailActions?.({ slug, id, client: admin.client })}
          {previewToggle}
          {ops.update ? (
            <Button type="button" size="sm" onClick={() => setEditing(true)}>
              {common.edit}
            </Button>
          ) : null}
          {ops.delete ? (
            <DocumentMenu
              singular={singular}
              deleting={remove.isPending}
              onDelete={() =>
                remove.mutate(id, {
                  onSuccess: () => navigate({ href: listBack.href }),
                })
              }
            />
          ) : null}
        </>
      }
    />
  );
  // The read view previews the stored document, so the page is visible
  // without entering edit mode.
  return previewAvailable && previewTarget && doc.data ? (
    <PreviewSplit slug={slug} target={previewTarget} open={preview.open} doc={doc.data}>
      {view}
    </PreviewSplit>
  ) : (
    view
  );
}

/** The header's overflow menu: Delete (behind a confirm dialog). */
function DocumentMenu({
  singular,
  deleting,
  onDelete,
}: {
  readonly singular: string;
  readonly deleting: boolean;
  readonly onDelete: () => void;
}): ReactNode {
  const [confirming, setConfirming] = useState(false);
  const { admin: m, common } = useMessages();
  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          render={<Button variant="outline" size="icon-sm" aria-label={m.moreActions} />}
        >
          <DotsThreeIcon weight="bold" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item variant="destructive" onClick={() => setConfirming(true)}>
            <TrashIcon aria-hidden />
            {common.delete}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>{m.deleteThis(singular.toLowerCase())}</AlertDialog.Title>
            <AlertDialog.Description>{m.deleteDescription}</AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>{common.cancel}</AlertDialog.Cancel>
            <AlertDialog.Action variant="destructive" disabled={deleting} onClick={onDelete}>
              {deleting ? common.deleting : common.delete}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}

/** The "History" section: the document's revisions, restorable. */
function HistorySection({
  slug,
  id,
  title,
  back,
  onRestore,
  restoring,
}: {
  readonly slug: string;
  readonly id: string;
  readonly title: string;
  readonly back: ReactNode;
  /** Absent when the collection's `operations.update` is off: history stays readable, not restorable. */
  readonly onRestore?: (rev: number) => void;
  readonly restoring: boolean;
}): ReactNode {
  const { admin } = useAdmin();
  const m = useMessages().admin;
  const api = collectionClient(admin.client, slug);
  const revisions = useInfiniteQuery({
    queryKey: [slug, id, "revisions"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.revisions(id, { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const items = revisions.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <PageLayout.Root data-slot="revision-history-page">
      <PageLayout.Header back={back}>
        <PageLayout.Title>{title}</PageLayout.Title>
        <PageLayout.Description>{m.history}</PageLayout.Description>
      </PageLayout.Header>
      <PageLayout.Body width="content">
        <RevisionHistory
          revisions={items}
          onRestore={onRestore}
          disabled={restoring}
          loading={revisions.isLoading || revisions.isFetchingNextPage}
          error={errorMessage(revisions.error)}
          nextCursor={revisions.hasNextPage ? "more" : null}
          onLoadMore={() => revisions.fetchNextPage()}
        />
      </PageLayout.Body>
    </PageLayout.Root>
  );
}
