// KanbanView — a board grouping a collection's rows into columns by one
// enum/select/status field. Columns come from the field's declared values (empty
// ones still show), plus a trailing "None" for unset rows. Each card renders a
// few fields through the display registry. Cards are draggable (native HTML5
// drag); dropping one on another column calls `onMove(rowId, value)`, which the
// host persists via `client.<slug>.update`. Presentational and router-agnostic
// like the rest of content-ui — the host fetches the rows (see the bounded
// "load all" the list screen does for board views) and wires `onMove`/`onRowClick`.

import type { Collection } from "@voila/content";
import { cn } from "@voila/ui/cn";
import type { ReactNode } from "react";
import { documentTitle } from "./detail-view";
import { FieldRenderer } from "./field-renderer";
import type { Doc } from "./lib/doc";
import { type DeclaredColumn, groupBy } from "./lib/group-by";
import { getFieldLabel } from "./lib/humanize";
import type { DisplayRegistry } from "./registry/registry";
import { selectOptions } from "./widgets/edit";

export interface KanbanViewProps {
  readonly collection: Collection;
  readonly rows: readonly Doc[];
  /** The enum/select/status field whose values become the board columns. */
  readonly groupField: string;
  /** Fields shown on each card. Defaults to the first non-hidden fields
   *  (excluding the group field). */
  readonly cardFields?: readonly string[];
  readonly registry?: DisplayRegistry;
  /**
   * Move a row to a new group value (drag-drop). The host persists it. The value
   * is the column's ORIGINAL field value (a numeric enum stays a number; the
   * "None" column is `null`), so it validates against the field on write.
   */
  readonly onMove?: (rowId: string, value: unknown) => void;
  readonly onRowClick?: (row: Doc) => void;
  readonly emptyMessage?: string;
}

/** The columns declared by the group field (enum values / select options). */
function declaredColumns(collection: Collection, groupField: string): DeclaredColumn[] {
  const field = collection.fields[groupField];
  if (!field) return [];
  // `raw` preserves the original value (e.g. a numeric enum value) so a move
  // writes the value the field validator expects, not its stringified key.
  return selectOptions(field.meta).map((option) => ({
    value: option.value,
    label: option.label,
    raw: option.raw,
  }));
}

/** Default card fields: the first few non-hidden fields, minus the group field
 *  and the title field (already shown as the card heading). */
function defaultCardFields(collection: Collection, groupField: string): string[] {
  return Object.keys(collection.fields)
    .filter(
      (k) => k !== groupField && k !== collection.titleField && !collection.fields[k]?.meta.hidden,
    )
    .slice(0, 3);
}

function rowId(row: Doc): string | undefined {
  const id = row.id;
  return typeof id === "string" ? id : typeof id === "number" ? String(id) : undefined;
}

export function KanbanView({
  collection,
  rows,
  groupField,
  cardFields,
  registry,
  onMove,
  onRowClick,
  emptyMessage = "No records.",
}: KanbanViewProps): ReactNode {
  const columns = groupBy(rows, groupField, { columns: declaredColumns(collection, groupField) });
  const fields = cardFields ?? defaultCardFields(collection, groupField);

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((column) => (
        <section
          key={column.key || "__none__"}
          aria-label={column.label}
          className="flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2"
          onDragOver={(event) => {
            if (onMove) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!onMove) return;
            event.preventDefault();
            const id = event.dataTransfer.getData("text/plain");
            if (id) onMove(id, column.raw);
          }}
        >
          <header className="flex items-center justify-between px-1">
            <h3 className="font-medium text-sm">{column.label}</h3>
            <span className="text-muted-foreground text-xs">{column.rows.length}</span>
          </header>
          {column.rows.map((row, index) => {
            const id = rowId(row);
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the card is a pointer affordance; keyboard/AT users open rows from the accessible table view.
              <article
                key={id ?? index}
                draggable={Boolean(onMove && id)}
                onDragStart={(event) => {
                  if (id) event.dataTransfer.setData("text/plain", id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "rounded-md border bg-card p-3 text-sm shadow-sm",
                  onMove && id ? "cursor-grab active:cursor-grabbing" : undefined,
                  onRowClick ? "hover:bg-accent" : undefined,
                )}
              >
                <p className="font-medium">
                  {documentTitle(collection, row) ?? `Row ${index + 1}`}
                </p>
                <dl className="mt-1 space-y-0.5">
                  {fields.map((key) => {
                    const field = collection.fields[key];
                    if (!field) return null;
                    return (
                      <div key={key} className="flex gap-2 text-xs">
                        <dt className="text-muted-foreground">{getFieldLabel(key, field)}</dt>
                        <dd className="min-w-0 truncate">
                          <FieldRenderer field={field} value={row[key]} registry={registry} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
