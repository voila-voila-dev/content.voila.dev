// ColumnPicker — choose which of a collection's fields a `ListView`/`DataTable`
// shows, and in what order. A popover with a checkbox per non-hidden field plus
// up/down reorder for the visible ones (no drag dependency in v1). Presentational
// and controlled: the host holds the ordered `value` (the column keys, e.g. from
// a saved view's `config.columns`) and feeds it straight into `ListView`'s
// `columns` prop; `onChange` emits the next ordered list.

import type { Collection } from "@voila/content";
import { buttonVariants } from "@voila/ui/button";
import { Checkbox } from "@voila/ui/checkbox";
import { cn } from "@voila/ui/cn";
import { CaretDownIcon, CaretUpIcon } from "@voila/ui/icons";
import { Popover } from "@voila/ui/popover";
import type { ReactNode } from "react";
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

export function ColumnPicker({
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

  return (
    <Popover.Root>
      <Popover.Trigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
        {label}
      </Popover.Trigger>
      <Popover.Content align="end" className="w-64">
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
              <li key={key} className="flex items-center gap-2">
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
      </Popover.Content>
    </Popover.Root>
  );
}
