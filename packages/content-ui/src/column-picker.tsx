// ColumnPicker — choose which of a collection's fields a `ListView`/`DataTable`
// shows, and in what order. A popover with a checkbox per non-hidden field;
// visible columns drag to reorder (a grip handle + native HTML5 drag), with
// up/down buttons kept as a keyboard-accessible fallback (native DnD is
// pointer-only). Presentational and controlled: the host holds the ordered
// `value` (the column keys, e.g. from a saved view's `config.columns`) and feeds
// it straight into `ListView`'s `columns` prop; `onChange` emits the next list.

import type { Collection } from "@voila/content";
import { buttonVariants } from "@voila/ui/button";
import { Checkbox } from "@voila/ui/checkbox";
import { cn } from "@voila/ui/cn";
import { CaretDownIcon, CaretUpIcon, DotsSixVerticalIcon } from "@voila/ui/icons";
import { Popover } from "@voila/ui/popover";
import { type ReactNode, useState } from "react";
import { getFieldLabel } from "./lib/humanize";

export interface ColumnPickerProps {
  readonly collection: Collection;
  /** Visible columns, in display order. */
  readonly value: readonly string[];
  /** Emits the next ordered list of visible columns. */
  readonly onChange: (columns: string[]) => void;
  /** Trigger label. Defaults to "Columns". */
  readonly label?: string;
}

/** The collection's non-hidden field keys — the pickable columns. */
function availableKeys(collection: Collection): string[] {
  return Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
}

/**
 * Move `from` to sit where `to` currently is within the ordered list (insert
 * before `to`). A no-op when either key is missing or they're the same — so a
 * stray drop never drops or duplicates a column.
 */
export function reorderColumns(visible: readonly string[], from: string, to: string): string[] {
  if (from === to) return [...visible];
  const without = visible.filter((k) => k !== from);
  const targetIdx = without.indexOf(to);
  if (targetIdx < 0 || !visible.includes(from)) return [...visible];
  without.splice(targetIdx, 0, from);
  return without;
}

export function ColumnPicker({
  collection,
  value,
  onChange,
  label = "Columns",
}: ColumnPickerProps): ReactNode {
  return (
    <Popover.Root>
      <Popover.Trigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        {label}
      </Popover.Trigger>
      <Popover.Content align="end" className="w-64">
        <ColumnEditor collection={collection} value={value} onChange={onChange} label={label} />
      </Popover.Content>
    </Popover.Root>
  );
}

/**
 * The checkbox/reorder list, *without* the popover chrome. Used directly when the
 * editor must live inside another floating layer (e.g. the view-edit dialog),
 * where nesting a Base UI popover inside a Base UI dialog would render it behind
 * the backdrop. Same controlled contract as {@link ColumnPicker}.
 */
export function ColumnEditor({
  collection,
  value,
  onChange,
  label = "Columns",
}: ColumnPickerProps): ReactNode {
  const available = availableKeys(collection);
  // Visible (in the caller's order), then the rest — so the menu lists chosen
  // columns first, unchosen below.
  const visible = value.filter((k) => available.includes(k));
  const hidden = available.filter((k) => !visible.includes(k));
  const ordered = [...visible, ...hidden];

  // Transient drag state: the key being dragged + the key it's hovering, used
  // for the visual cues. The reorder itself reads the source from the drag's
  // dataTransfer, so it's correct even if a render lags the cursor.
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  function toggle(key: string) {
    onChange(visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key]);
  }

  function move(key: string, delta: number) {
    const idx = visible.indexOf(key);
    const next = idx + delta;
    if (idx < 0 || next < 0 || next >= visible.length) return;
    const copy = [...visible];
    const [moved] = copy.splice(idx, 1);
    if (moved !== undefined) copy.splice(next, 0, moved);
    onChange(copy);
  }

  function drop(targetKey: string, source: string | null) {
    setDragKey(null);
    setOverKey(null);
    if (!source || !visible.includes(source) || !visible.includes(targetKey)) return;
    onChange(reorderColumns(visible, source, targetKey));
  }

  return (
    <>
      <p className="mb-2 font-medium text-sm">{label}</p>
      <ul className="space-y-1">
        {ordered.map((key) => {
          const field = collection.fields[key];
          if (!field) return null;
          const fieldLabel = getFieldLabel(key, field);
          const isVisible = visible.includes(key);
          const pos = visible.indexOf(key);
          const id = `colpick-${collection.slug}-${key}`;
          return (
            <li
              key={key}
              draggable={isVisible}
              onDragStart={
                isVisible
                  ? (event) => {
                      event.dataTransfer.setData("text/plain", key);
                      event.dataTransfer.effectAllowed = "move";
                      setDragKey(key);
                    }
                  : undefined
              }
              onDragOver={
                isVisible
                  ? (event) => {
                      // Allow the drop + show the insertion target.
                      event.preventDefault();
                      if (overKey !== key) setOverKey(key);
                    }
                  : undefined
              }
              onDrop={
                isVisible
                  ? (event) => {
                      event.preventDefault();
                      drop(key, event.dataTransfer.getData("text/plain") || dragKey);
                    }
                  : undefined
              }
              onDragEnd={() => {
                setDragKey(null);
                setOverKey(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded",
                isVisible && dragKey === key && "opacity-50",
                isVisible && overKey === key && dragKey !== key && "bg-accent",
              )}
            >
              {isVisible ? (
                <DotsSixVerticalIcon
                  aria-hidden
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <Checkbox id={id} checked={isVisible} onCheckedChange={() => toggle(key)} />
              <label htmlFor={id} className="flex-1 text-sm">
                {fieldLabel}
              </label>
              {isVisible ? (
                <span className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Move ${fieldLabel} up`}
                    disabled={pos === 0}
                    onClick={() => move(key, -1)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <CaretUpIcon className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${fieldLabel} down`}
                    disabled={pos === visible.length - 1}
                    onClick={() => move(key, 1)}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <CaretDownIcon className="size-4" aria-hidden />
                  </button>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
