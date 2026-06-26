// DetailView — the read view for one document: a header (title + an actions slot
// like Edit / Delete) over a definition list that renders every non-hidden field
// through `FieldRenderer`, so each value is shown by the widget registry the same
// way `DataTable` cells are. Presentational and router-agnostic — the host fetches
// the document with the typed `@voila/content/client` (`client.<slug>.find(id)`)
// and passes it in as `doc`. Editing is the separate `CollectionForm`.

import type { Collection } from "@voila/content";
import { type ReactNode, useState } from "react";
import { FieldCard } from "./field-card";
import { FieldGroupNav } from "./field-group-nav";
import { FieldRenderer } from "./field-renderer";
import type { Doc } from "./lib/doc";
import { resolveFieldGroups } from "./lib/groups";
import { getFieldLabel, humanize } from "./lib/humanize";
import { PageLayout } from "./page-layout";
import type { DisplayRegistry } from "./registry/registry";

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
  /** Header actions (e.g. Edit / Delete); rendered on the right. Only shown
   *  alongside a document — hidden during loading / error / not-found. */
  readonly actions?: ReactNode;
  /** While true (and no `doc` yet), shows a loading placeholder. */
  readonly loading?: boolean;
  /** Form-level error message (e.g. a failed fetch); shown as an alert. */
  readonly error?: string;
  /** Shown when there's no `doc` and we're not loading. Defaults to "Not found." */
  readonly emptyMessage?: string;
  /**
   * The active field group's id, when the collection declares `groups`. The
   * detail page renders a left sub-nav + one card per group; `activeGroup`
   * selects which group is shown (e.g. from a `?group=` URL). Optional and
   * controlled — omit it and the view manages its own active group internally,
   * defaulting to the first group. Ignored when the collection has no `groups`.
   */
  readonly activeGroup?: string;
  /** Called with a group id when the user picks one in the sub-nav. */
  readonly onGroupChange?: (id: string) => void;
}

interface Row {
  readonly key: string;
  readonly label: string;
}

/** The document's own name: the `titleField` value when the collection declares
 *  one and the document holds a non-empty scalar there. */
export function documentTitle(collection: Collection, doc: Doc): string | undefined {
  if (collection.titleField === undefined) return undefined;
  const value = doc[collection.titleField];
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

export function DetailView({
  collection,
  doc,
  fields,
  registry,
  title,
  description,
  actions,
  loading = false,
  error,
  emptyMessage,
  activeGroup,
  onGroupChange,
}: DetailViewProps): ReactNode {
  const hasDoc = doc !== null && doc !== undefined;
  const heading =
    title ??
    (hasDoc ? documentTitle(collection, doc) : undefined) ??
    collection.label ??
    humanize(collection.slug);
  const rows = hasDoc ? resolveRows(collection, fields) : [];

  // Grouped layout: only when the collection declares `groups`. The active
  // group is controlled by `activeGroup` when given, else tracked internally;
  // either way it's clamped to a real group (falling back to the first).
  const grouped = (collection.groups?.length ?? 0) > 0;
  const resolvedGroups = grouped ? resolveFieldGroups(collection, { fields }) : [];
  const [internalGroup, setInternalGroup] = useState<string | undefined>(undefined);
  const currentGroupId = activeGroup ?? internalGroup;
  const activeResolved = resolvedGroups.find((g) => g.id === currentGroupId) ?? resolvedGroups[0];
  function selectGroup(id: string) {
    onGroupChange?.(id);
    setInternalGroup(id);
  }

  // One `<dt>/<dd>` pair for a field, shared by the flat and grouped layouts.
  function fieldRow(key: string, d: Doc): ReactNode {
    const field = collection.fields[key];
    if (!field) return null;
    return (
      <div key={key} className="contents">
        <dt className="font-medium text-muted-foreground">{getFieldLabel(key, field)}</dt>
        <dd>
          <FieldRenderer field={field} value={d[key]} registry={registry} />
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
      ? "Loading…"
      : !hasDoc
        ? (emptyMessage ?? "Not found.")
        : "";

  // The read card's body: an optional group description over the field list.
  // A self-contained (fully-closed) `FieldCard.Card` — there's no Save footer
  // in the read view, so an open-bottomed `Body` would look unfinished.
  function readCard(fieldKeys: readonly string[], groupDescription?: string): ReactNode {
    return (
      <FieldCard.Root>
        <FieldCard.Card className="space-y-3">
          {groupDescription ? (
            <FieldCard.Description className="mt-0">{groupDescription}</FieldCard.Description>
          ) : null}
          <dl className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-x-4 gap-y-3 text-sm">
            {fieldKeys.map((key) => fieldRow(key, doc as Doc))}
          </dl>
        </FieldCard.Card>
      </FieldCard.Root>
    );
  }

  return (
    <PageLayout.Root>
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <PageLayout.Header>
        <div className="space-y-1">
          <PageLayout.Title>{heading}</PageLayout.Title>
          {description ? <PageLayout.Description>{description}</PageLayout.Description> : null}
        </div>
        {actions && hasDoc ? <div className="flex items-center gap-2">{actions}</div> : null}
      </PageLayout.Header>

      {error ? (
        <PageLayout.Body>
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        </PageLayout.Body>
      ) : hasDoc ? (
        grouped && activeResolved ? (
          // The sub-nav stays pinned full-height beside the scrolling card body.
          <PageLayout.NavigationLayout>
            <FieldGroupNav
              groups={resolvedGroups}
              activeGroup={activeResolved.id}
              onSelect={selectGroup}
              title="Sections"
            />
            <PageLayout.Body>
              {readCard(activeResolved.fieldKeys, activeResolved.description)}
            </PageLayout.Body>
          </PageLayout.NavigationLayout>
        ) : (
          <PageLayout.Body>{readCard(rows.map((row) => row.key))}</PageLayout.Body>
        )
      ) : (
        <PageLayout.Body>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : (emptyMessage ?? "Not found.")}
          </p>
        </PageLayout.Body>
      )}
    </PageLayout.Root>
  );
}
