// DetailView — the read view for one document: a header (title + an actions slot
// like Edit / Delete) over a definition list that renders every non-hidden field
// through `FieldRenderer`, so each value is shown by the widget registry the same
// way `DataTable` cells are. Presentational and router-agnostic — the host fetches
// the document with the typed `@voila/content/client` (`client.<slug>.find(id)`)
// and passes it in as `doc`. Editing is the separate `CollectionForm`.

import type { Collection } from "@voila/content";
import type { ReactNode } from "react";
import { FieldRenderer } from "./field-renderer";
import type { Doc } from "./lib/doc";
import { getFieldLabel, humanize } from "./lib/humanize";
import type { DisplayRegistry } from "./registry/registry";

export interface DetailViewProps {
  readonly collection: Collection;
  /** The document to display (e.g. `client.<slug>.find(id)`). */
  readonly doc: Doc;
  /** Field keys to show, in order. Defaults to all non-hidden fields. */
  readonly fields?: readonly string[];
  /** Override display widgets per kind/name. */
  readonly registry?: DisplayRegistry;
  /** Header title. Defaults to the document's `titleField` value (when the
   *  collection declares one), then the collection label / humanized slug. */
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  /** Header actions (e.g. Edit / Delete); rendered on the right. */
  readonly actions?: ReactNode;
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
}: DetailViewProps): ReactNode {
  const heading =
    title ?? documentTitle(collection, doc) ?? collection.label ?? humanize(collection.slug);
  const rows = resolveRows(collection, fields);

  return (
    <section className="space-y-4">
      <header className="flex items-start gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{heading}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </header>

      <dl className="grid grid-cols-[minmax(8rem,12rem)_1fr] gap-x-4 gap-y-3 text-sm">
        {rows.map((row) => {
          const field = collection.fields[row.key];
          if (!field) return null;
          return (
            <div key={row.key} className="contents">
              <dt className="font-medium text-muted-foreground">{row.label}</dt>
              <dd>
                <FieldRenderer field={field} value={doc[row.key]} registry={registry} />
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
