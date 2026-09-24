// DetailView — the read view for one document: the single page header (back ·
// document title · actions) over an identity strip (status, updated-at, id)
// and a definition list that renders every non-hidden field through
// `FieldRenderer`, so each value is shown by the widget registry the same way
// `DataTable` cells are. Presentational and router-agnostic — the host fetches
// the document with the typed `@voila/content/client` (`client.<slug>.find(id)`)
// and passes it in as `doc`. Grouped collections show ONE group at a time; on
// desktop the group list lives in the sidebar (the host registers it through
// `useRegisterSidebarSection`), on mobile it's the `FieldGroupNav` strip under
// the header. Editing is the separate `CollectionForm`.

import type { Collection } from "@voila/content";
import { CopyableText } from "@voila.dev/ui/copyable-text";
import { type ReactNode, useState } from "react";
import { FieldCard } from "./field-card";
import { FieldGroupNav } from "./field-group-nav";
import { FieldRenderer } from "./field-renderer";
import type { Doc } from "./lib/doc";
import { resolveFieldGroups } from "./lib/groups";
import { getFieldLabel, humanize } from "./lib/humanize";
import { type I18nContextValue, resolveLocalized, useI18n } from "./lib/i18n";
import { useMessages } from "./lib/messages";
import { PageLayout } from "./page-layout";
import type { DisplayRegistry } from "./registry/registry";
import { formatDate, relativeDate } from "./widgets/display";
import { StatusBadge } from "./widgets/status-badge";

export interface DetailViewProps {
  readonly collection: Collection;
  /**
   * The document to display (e.g. `client.<slug>.find(id)`). Optional so a host
   * can render `DetailView` directly through the fetch lifecycle: `null` /
   * `undefined` with `loading` shows the loading state, and without it shows the
   * `emptyMessage` (not-found) state — mirroring `ListView`.
   */
  readonly doc?: Doc | null;
  /** Field keys to show, in order. Defaults to all non-hidden fields. */
  readonly fields?: readonly string[];
  /** Override display widgets per kind/name. */
  readonly registry?: DisplayRegistry;
  /** Header title. Defaults to the document's `titleField` value (when the
   *  collection declares one), then the collection label / humanized slug. */
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  /** The header's back link (see `PageLayout.Back`). */
  readonly back?: ReactNode;
  /** Header actions (e.g. Edit / an overflow menu); rendered on the right. Only
   *  shown alongside a document — hidden during loading / error / not-found. */
  readonly actions?: ReactNode;
  /** Extra content under the identity strip (e.g. publish controls). */
  readonly aside?: ReactNode;
  /** Hide the identity strip (status · updated · id). */
  readonly hideMeta?: boolean;
  /** While true (and no `doc` yet), shows a loading placeholder. */
  readonly loading?: boolean;
  /** Form-level error message (e.g. a failed fetch); shown as an alert. */
  readonly error?: string;
  /** Shown when there's no `doc` and we're not loading. Defaults to "Not found." */
  readonly emptyMessage?: string;
  /**
   * The active field group's id, when the collection declares `groups`. The
   * page renders one card for that group; `activeGroup` selects which (e.g. from
   * the route). Optional and controlled — omit it and the view manages its own
   * active group internally, defaulting to the first group.
   */
  readonly activeGroup?: string;
  /** Called with a group id when the user picks one in the mobile strip. */
  readonly onGroupChange?: (id: string) => void;
}

interface Row {
  readonly key: string;
  readonly label: string;
}

/** The document's own name: the `titleField` value when the collection declares
 *  one and the document holds a non-empty scalar there — resolved through the
 *  locale chain when the field is localized. */
export function documentTitle(
  collection: Collection,
  doc: Doc,
  i18n?: I18nContextValue,
): string | undefined {
  if (collection.titleField === undefined) return undefined;
  const raw = doc[collection.titleField];
  const field = collection.fields[collection.titleField];
  const value = field?.meta.localized === true ? resolveLocalized(raw, i18n).value : raw;
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (typeof value === "number") return String(value);
  return undefined;
}

/** Explicit `fields` (filtered to known keys) or every non-hidden field, in order. */
function resolveRows(collection: Collection, fields?: readonly string[]): Row[] {
  const keys = fields ?? Object.keys(collection.fields);
  const out: Row[] = [];
  for (const key of keys) {
    const field = collection.fields[key];
    if (!field) continue;
    if (fields === undefined && field.meta.hidden) continue;
    out.push({ key, label: getFieldLabel(key, field) });
  }
  return out;
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/** The identity strip under the header: status · updated-at · copyable id. */
function EntityMeta({ collection, doc }: { collection: Collection; doc: Doc }): ReactNode {
  const id = typeof doc.id === "string" || typeof doc.id === "number" ? String(doc.id) : undefined;
  const updated = toDate(doc.updatedAt) ?? toDate(doc.createdAt);
  const showStatus = collection.drafts === true;
  const { locale } = useI18n();
  const m = useMessages().form;
  if (!id && !updated && !showStatus) return null;
  return (
    <div
      data-slot="entity-meta"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs"
    >
      {showStatus ? <StatusBadge doc={doc} /> : null}
      {updated ? (
        <span title={formatDate(updated, "datetime", locale)}>
          {m.updated(
            relativeDate(updated, undefined, locale) ?? formatDate(updated, "datetime", locale),
          )}
        </span>
      ) : null}
      {id ? (
        <CopyableText
          value={id}
          label={id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id}
          muted
          copyLabel={m.copyId}
          copiedLabel={m.copied}
          className="text-xs"
        />
      ) : null}
    </div>
  );
}

function Root({
  collection,
  doc,
  fields,
  registry,
  title,
  description,
  back,
  actions,
  aside,
  hideMeta = false,
  loading = false,
  error,
  emptyMessage,
  activeGroup,
  onGroupChange,
}: DetailViewProps): ReactNode {
  const i18n = useI18n();
  const messages = useMessages();
  const hasDoc = doc !== null && doc !== undefined;
  const heading =
    title ??
    (hasDoc ? documentTitle(collection, doc, i18n) : undefined) ??
    collection.label ??
    humanize(collection.slug);
  const rows = hasDoc ? resolveRows(collection, fields) : [];

  // Grouped layout: only when the collection declares `groups`. The active
  // group is controlled by `activeGroup` when given, else tracked internally;
  // either way it's clamped to a real group (falling back to the first).
  const grouped = (collection.groups?.length ?? 0) > 0;
  const resolvedGroups = grouped
    ? resolveFieldGroups(collection, { fields, generalLabel: messages.shell.generalGroup })
    : [];
  const [internalGroup, setInternalGroup] = useState<string | undefined>(undefined);
  const currentGroupId = activeGroup ?? internalGroup;
  const activeResolved = resolvedGroups.find((g) => g.id === currentGroupId) ?? resolvedGroups[0];
  function selectGroup(id: string) {
    onGroupChange?.(id);
    setInternalGroup(id);
  }

  // One `<dt>/<dd>` pair for a field, shared by the flat and grouped layouts.
  // Labels are small + muted; values carry the body size, so the two columns
  // read as label → value rather than two equal texts.
  function fieldRow(key: string, d: Doc): ReactNode {
    const field = collection.fields[key];
    if (!field) return null;
    return (
      <div
        key={key}
        className="contents [&:not(:first-child)>dt]:pt-3 sm:[&:not(:first-child)>dt]:pt-0.5"
      >
        <dt className="pt-0.5 font-medium text-muted-foreground text-xs leading-5 sm:text-sm">
          {getFieldLabel(key, field)}
        </dt>
        <dd className="min-w-0 text-sm [&_.voila-rich-text]:min-h-0 [&_.voila-rich-text]:p-0 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
          <FieldRenderer field={field} value={d[key]} registry={registry} context="detail" />
        </dd>
      </div>
    );
  }

  // What an assistive-tech user hears when the view's state changes — mirroring
  // `ListView`. The visible loading / not-found text below isn't in a live
  // region, so screen readers stay silent on those transitions without this.
  const liveMessage = error
    ? error
    : loading && !hasDoc
      ? messages.common.loading
      : !hasDoc
        ? (emptyMessage ?? messages.form.notFound)
        : "";

  // The read card's body: an optional group description over the field list.
  // A self-contained (fully-closed) `FieldCard.Card` — there's no Save footer
  // in the read view, so an open-bottomed `Body` would look unfinished. Height
  // hugs the rows (no min-height).
  function readCard(fieldKeys: readonly string[], groupDescription?: string): ReactNode {
    return (
      <FieldCard.Root>
        <FieldCard.Card className="space-y-4 p-5 sm:p-6">
          {groupDescription ? (
            <FieldCard.Description className="my-0">{groupDescription}</FieldCard.Description>
          ) : null}
          {/* Label above value on a phone (a 7rem label column leaves the value a
              sliver at 390px), side by side from `sm` up. */}
          <dl className="grid grid-cols-1 items-start gap-x-6 gap-y-1 sm:grid-cols-[minmax(7rem,11rem)_1fr] sm:gap-y-3">
            {fieldKeys.map((key) => fieldRow(key, doc as Doc))}
          </dl>
        </FieldCard.Card>
      </FieldCard.Root>
    );
  }

  const meta = hasDoc && !hideMeta ? <EntityMeta collection={collection} doc={doc} /> : null;

  return (
    <PageLayout.Root data-slot="detail-view">
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <PageLayout.Header back={back} actions={actions && hasDoc ? actions : undefined}>
        <PageLayout.Title>{heading}</PageLayout.Title>
        {description ? <PageLayout.Description>{description}</PageLayout.Description> : null}
      </PageLayout.Header>

      {hasDoc && grouped && activeResolved ? (
        <FieldGroupNav
          groups={resolvedGroups}
          activeGroup={activeResolved.id}
          onSelect={selectGroup}
        />
      ) : null}

      {error ? (
        <PageLayout.Body width="content">
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        </PageLayout.Body>
      ) : hasDoc ? (
        <PageLayout.Body width="content" className="space-y-4">
          {meta || aside ? (
            <div className="space-y-3">
              {meta}
              {aside}
            </div>
          ) : null}
          {grouped && activeResolved
            ? readCard(activeResolved.fieldKeys, activeResolved.description)
            : readCard(rows.map((row) => row.key))}
        </PageLayout.Body>
      ) : (
        <PageLayout.Body width="content">
          <p className="text-muted-foreground text-sm">
            {loading ? messages.common.loading : (emptyMessage ?? messages.form.notFound)}
          </p>
        </PageLayout.Body>
      )}
    </PageLayout.Root>
  );
}

/** Schema-driven read view for one document. `DetailView.Root` renders the
 *  header + identity strip + a definition list (or the active group's card). */
export const DetailView = {
  Root,
};
