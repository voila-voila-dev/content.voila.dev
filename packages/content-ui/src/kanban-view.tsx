// KanbanView — a board grouping a collection's rows into columns by one
// enum/select/status field. Columns come from the field's declared values (empty
// ones still show), plus a trailing "None" for unset rows. Each card renders a
// few fields through the display registry. Drag-and-drop is `@dnd-kit/react`
// (pointer + keyboard sensors, auto-scroll, a `DragOverlay` clone that follows
// the cursor — no native HTML5 ghost): the origin card fades, the column under
// the pointer highlights, and dropping calls `onMove(rowId, value)`, which the
// host persists via `client.<slug>.update`. The move is applied optimistically
// (the card lands in its new column at once) until the refetched `rows` agree.
// Presentational and router-agnostic like the rest of content-ui — the host
// fetches the rows (see the bounded "load all" the list screen does for board
// views) and wires `onMove`/`onRowClick`.

import { DragDropProvider, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/react";
import type { Collection } from "@voila/content";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { documentTitle } from "./detail-view";
import { FieldRenderer } from "./field-renderer";
import { defaultCardFields } from "./lib/card-fields";
import type { Doc } from "./lib/doc";
import { type DeclaredColumn, type GroupColumn, groupBy } from "./lib/group-by";
import { getFieldLabel } from "./lib/humanize";
import { type I18nContextValue, useI18n } from "./lib/i18n";
import type { DisplayRegistry } from "./registry/registry";
import { selectOptions } from "./widgets/edit";

export interface KanbanViewProps {
  readonly collection: Collection;
  readonly rows: readonly Doc[];
  /** The enum/select/status field whose values become the board columns. */
  readonly groupField: string;
  /** Fields shown on each card. Defaults to a few short non-hidden fields
   *  (excluding the group field and the title field). */
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

function rowId(row: Doc): string | undefined {
  const id = row.id;
  return typeof id === "string" ? id : typeof id === "number" ? String(id) : undefined;
}

/** Droppable ids are prefixed so a column can never collide with a row id. */
const COLUMN_PREFIX = "column:";

interface CardContentProps {
  readonly collection: Collection;
  readonly row: Doc;
  readonly fields: readonly string[];
  readonly registry?: DisplayRegistry;
  readonly i18n: I18nContextValue;
}

/** The card body: title + a few "label value" lines. Shared by the card and its overlay clone. */
function CardContent({ collection, row, fields, registry, i18n }: CardContentProps): ReactNode {
  return (
    <>
      <p className="font-medium">{documentTitle(collection, row, i18n) ?? "Untitled"}</p>
      <dl className="mt-1 space-y-0.5">
        {fields.map((key) => {
          const field = collection.fields[key];
          if (!field) return null;
          return (
            <div key={key} className="flex gap-2 text-xs">
              <dt className="shrink-0 text-muted-foreground">{getFieldLabel(key, field)}</dt>
              <dd className="min-w-0 truncate">
                <FieldRenderer field={field} value={row[key]} registry={registry} context="card" />
              </dd>
            </div>
          );
        })}
      </dl>
    </>
  );
}

interface CardProps extends CardContentProps {
  readonly id: string;
  readonly columnKey: string;
  readonly draggable: boolean;
  readonly onClick?: () => void;
}

function Card({ id, columnKey, draggable, onClick, ...content }: CardProps): ReactNode {
  // Stable `data` object: dnd-kit syncs input changes into its store, so a
  // fresh object every render would re-trigger that sync on each re-render.
  const data = useMemo(() => ({ column: columnKey }), [columnKey]);
  const { ref, isDragging } = useDraggable({ id, data, disabled: !draggable });
  const title = documentTitle(content.collection, content.row, content.i18n) ?? "Untitled";
  return (
    // biome-ignore lint/a11y/useSemanticElements: an article is the right landmark for a card; the click is a pointer shortcut, the row link lives in the table view.
    <article
      ref={ref}
      data-row-id={id}
      data-dragging={isDragging || undefined}
      aria-label={title}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter") onClick();
            }
          : undefined
      }
      className={cn(
        "rounded-md border bg-card p-3 text-sm shadow-sm outline-none transition-[opacity,box-shadow]",
        "focus-visible:ring-2 focus-visible:ring-ring",
        draggable && "cursor-grab touch-none active:cursor-grabbing",
        onClick && "hover:bg-accent",
        isDragging && "opacity-30",
      )}
    >
      <CardContent {...content} />
    </article>
  );
}

interface ColumnProps {
  readonly column: GroupColumn;
  readonly droppable: boolean;
  readonly children: ReactNode;
}

function Column({ column, droppable, children }: ColumnProps): ReactNode {
  const data = useMemo(() => ({ key: column.key }), [column.key]);
  const { ref, isDropTarget } = useDroppable({
    id: `${COLUMN_PREFIX}${column.key}`,
    data,
    disabled: !droppable,
  });
  return (
    <section
      ref={ref}
      aria-label={column.label}
      data-over={isDropTarget || undefined}
      className={cn(
        "flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-muted/30 p-2 transition-colors",
        isDropTarget && "border-primary/50 bg-accent ring-2 ring-primary/20",
      )}
    >
      <header className="flex items-center justify-between px-1">
        <h3 className="font-medium text-sm">{column.label}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">{column.rows.length}</span>
      </header>
      {children}
    </section>
  );
}

function Root({
  collection,
  rows,
  groupField,
  cardFields,
  registry,
  onMove,
  onRowClick,
  emptyMessage = "No records.",
}: KanbanViewProps): ReactNode {
  const i18n = useI18n();
  const fields =
    cardFields && cardFields.length > 0 ? cardFields : defaultCardFields(collection, [groupField]);

  // Optimistic moves: row id → the column value it was dropped on. Applied over
  // `rows` until the refetched data agrees, then dropped.
  const [pending, setPending] = useState<ReadonlyMap<string, unknown>>(() => new Map());
  useEffect(() => {
    if (pending.size === 0) return;
    const settled = [...pending].filter(([id, value]) =>
      rows.some((row) => rowId(row) === id && String(row[groupField]) === String(value)),
    );
    if (settled.length === 0) return;
    setPending((prev) => {
      const next = new Map(prev);
      for (const [id] of settled) next.delete(id);
      return next;
    });
  }, [rows, groupField, pending]);
  const effectiveRows = rows.map((row) => {
    const id = rowId(row);
    return id !== undefined && pending.has(id) ? { ...row, [groupField]: pending.get(id) } : row;
  });

  const columns = groupBy(effectiveRows, groupField, {
    columns: declaredColumns(collection, groupField),
  });
  const byId = new Map(effectiveRows.map((row) => [rowId(row), row] as const));

  // A completed drag ends with a click on the same card; swallow that one click
  // so a drop never also opens the document.
  const suppressClick = useRef(false);

  if (rows.length === 0) {
    return (
      <p data-slot="kanban-view" className="text-muted-foreground text-sm">
        {emptyMessage}
      </p>
    );
  }

  return (
    <DragDropProvider
      onDragStart={() => {
        suppressClick.current = true;
      }}
      onDragEnd={(event) => {
        // Let the trailing click through again on the next tick.
        setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        if (event.canceled) return;
        const { source, target } = event.operation;
        if (!source || !target) return;
        const id = String(source.id);
        const targetKey = String(target.id).slice(COLUMN_PREFIX.length);
        const from = (source.data as { column?: string } | undefined)?.column;
        if (targetKey === from) return;
        const column = columns.find((c) => c.key === targetKey);
        if (!column) return;
        setPending((prev) => new Map(prev).set(id, column.raw));
        onMove?.(id, column.raw);
      }}
    >
      <div data-slot="kanban-view" className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => (
          <Column key={column.key || "__none__"} column={column} droppable={onMove !== undefined}>
            {column.rows.map((row, index) => {
              const id = rowId(row) ?? `row-${index}`;
              return (
                <Card
                  key={id}
                  id={id}
                  columnKey={column.key}
                  draggable={onMove !== undefined && rowId(row) !== undefined}
                  collection={collection}
                  row={row}
                  fields={fields}
                  registry={registry}
                  i18n={i18n}
                  onClick={
                    onRowClick
                      ? () => {
                          if (suppressClick.current) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                />
              );
            })}
          </Column>
        ))}
      </div>

      {/* The clone that follows the pointer (the origin card fades in place). */}
      <DragOverlay className="pointer-events-none z-50 rotate-1 rounded-md border bg-card p-3 text-sm shadow-xl">
        {(source) => {
          const row = byId.get(String(source.id));
          return row ? (
            <CardContent
              collection={collection}
              row={row}
              fields={fields}
              registry={registry}
              i18n={i18n}
            />
          ) : null;
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}

/** Schema-driven kanban board. `KanbanView.Root` groups rows into columns by an
 *  enum/select field; cards drag between columns (pointer + keyboard). */
export const KanbanView = {
  Root,
};
