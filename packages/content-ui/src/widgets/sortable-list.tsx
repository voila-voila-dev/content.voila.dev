// SortableList — the collapsible, reorderable card list behind the blocks and
// object-array editors. Each row is a header (drag handle, an optional badge,
// a one-line summary, move / remove controls) over a body the caller renders
// when the row is expanded. Rows are collapsed unless the caller opened them
// (a just-added item) or they carry a validation issue, which forces them
// open so the message is visible. Reordering is native HTML5 drag plus the
// up / down buttons — the same dependency-free pattern as the column picker.
// Cards expand with a plain disclosure button (no height animation: a body's
// fields grow as items are added, which an animated panel would clip).
//
// The list owns no value: the caller keeps the array and its `useItemKeys`
// and answers `onMove` / `onRemove`, so blocks (with their `type` invariant)
// and plain object arrays share one shell.

import {
  CaretDownIcon,
  CaretUpIcon,
  DotsSixVerticalIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { Button } from "@voila.dev/ui/button";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useEffect, useImperativeHandle, useState } from "react";
import { FocusPathProvider, useFocusPath } from "../lib/focus-path";
import { type FieldIssue, issuesUnder } from "../lib/validate";

export interface SortableRowHeader {
  /** A chip before the summary (the block type). */
  readonly badge?: ReactNode;
  /** Plain text of what the row holds; the fallback when empty is `label`. */
  readonly summary?: string;
  /** Read out with the row's aria-labels ("block", "item"). */
  readonly label: string;
}

export interface SortableListHandle {
  /** Expand the row at `key` (a just-added item) and focus `focusId` once rendered. */
  open(key: string, focusId?: string): void;
}

export interface SortableListProps<T> {
  readonly items: ReadonlyArray<T>;
  /** Stable keys parallel to `items` (see `useItemKeys`). */
  readonly keys: ReadonlyArray<string>;
  /** Noun for the aria-labels: "block", "item". */
  readonly noun: string;
  readonly idPrefix: string;
  readonly issues?: ReadonlyArray<FieldIssue>;
  readonly disabled?: boolean;
  /** Remove is refused at the list's minimum. */
  readonly atMin?: boolean;
  readonly header: (item: T, index: number) => SortableRowHeader;
  readonly body: (item: T, index: number) => ReactNode;
  readonly onMove: (from: number, to: number) => void;
  readonly onRemove: (index: number) => void;
  /** Extra `data-*` on each row (the block type). */
  readonly rowData?: (item: T, index: number) => Record<string, string | undefined>;
  readonly ref?: React.Ref<SortableListHandle>;
}

export function SortableList<T>({
  items,
  keys,
  noun,
  idPrefix,
  issues,
  disabled,
  atMin,
  header,
  body,
  onMove,
  onRemove,
  rowData,
  ref,
}: SortableListProps<T>): ReactNode {
  // Which rows are expanded, by stable key.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  // The enclosing document path, when a form tracks focus for a live preview.
  const focus = useFocusPath();
  // Transient drag state for the visual cues; the reorder reads the source
  // index from the drag's dataTransfer so it is right even if a render lags.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // A just-added row gets focus on its first control once it has rendered.
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  useEffect(() => {
    if (pendingFocus === null) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  function toggle(key: string, expanded: boolean): void {
    setOpen((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(key);
      else next.delete(key);
      return next;
    });
    if (focus) {
      const index = keys.indexOf(key);
      focus.report(expanded && index !== -1 ? [...focus.path, index] : null);
    }
  }
  useImperativeHandle(ref, () => ({
    open(key, focusId) {
      toggle(key, true);
      if (focusId !== undefined) setPendingFocus(focusId);
    },
  }));

  function move(from: number, to: number): void {
    if (to < 0 || to >= items.length || from === to) return;
    onMove(from, to);
  }
  function drop(target: number, source: number | null): void {
    setDragIndex(null);
    setOverIndex(null);
    if (source === null || Number.isNaN(source)) return;
    move(source, target);
  }

  return (
    <ul data-slot="sortable-list" className="space-y-2">
      {items.map((item, index) => {
        const key = keys[index] ?? String(index);
        const rowIssues = issuesUnder(issues, index);
        const invalid = rowIssues.length > 0;
        const expanded = invalid || open.has(key);
        const { badge, summary, label } = header(item, index);
        const panelId = `${idPrefix}-${index}-panel`;
        return (
          <li
            key={key}
            data-slot={noun}
            {...rowData?.(item, index)}
            draggable={!disabled}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", String(index));
              event.dataTransfer.effectAllowed = "move";
              setDragIndex(index);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (overIndex !== index) setOverIndex(index);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData("text/plain");
              drop(index, raw === "" ? dragIndex : Number(raw));
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cn(
              "rounded-md border bg-card",
              invalid && "border-destructive",
              dragIndex === index && "opacity-50",
              overIndex === index && dragIndex !== index && "ring-2 ring-ring",
            )}
          >
            <div data-slot={`${noun}-header`} className="flex items-center gap-2 px-2 py-1.5">
              <DotsSixVerticalIcon
                aria-hidden
                className="size-4 shrink-0 cursor-grab text-muted-foreground"
              />
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={expanded ? panelId : undefined}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${noun} ${index + 1}: ${label}`}
                onClick={() => toggle(key, !expanded)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {badge}
                {summary ? (
                  <span className="min-w-0 truncate text-muted-foreground text-sm">{summary}</span>
                ) : badge ? null : (
                  <span className="min-w-0 truncate text-muted-foreground text-sm">{label}</span>
                )}
                {invalid ? (
                  <WarningCircleIcon
                    aria-label="Has errors"
                    className="size-4 shrink-0 text-destructive"
                  />
                ) : null}
                <CaretDownIcon
                  aria-hidden
                  className={cn(
                    "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>
              <span className="flex shrink-0 items-center">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move ${noun} ${index + 1} up`}
                  disabled={disabled || index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <CaretUpIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Move ${noun} ${index + 1} down`}
                  disabled={disabled || index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <CaretDownIcon aria-hidden />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${noun} ${index + 1}`}
                  disabled={disabled || atMin}
                  onClick={() => onRemove(index)}
                >
                  <XIcon aria-hidden />
                </Button>
              </span>
            </div>
            {expanded ? (
              <div id={panelId} className="border-t px-4 py-4">
                <FocusPathProvider path={[index]}>{body(item, index)}</FocusPathProvider>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
