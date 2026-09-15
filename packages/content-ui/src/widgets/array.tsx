// Array widgets — the editor and reader for `fields.array(item)`. The editor is
// a list of the item field's own widget (resolved from the registry in scope),
// each row with move up / move down / remove, plus an "Add item" button that
// respects `min` / `max`. Emits a fresh array on every edit and `undefined`
// when the last item goes, so an optional list goes back to "not provided".
// Without `meta.item` (a bare-validator element) it degrades to the
// unsupported-input notice, exactly as before.

import { CaretDownIcon, CaretUpIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import type { Field } from "@voila/content";
import { Button } from "@voila.dev/ui/button";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useRef } from "react";
import { issueMessageAt, issuesUnder } from "../lib/validate";
import { useDisplayRegistry, useEditRegistry } from "../registry/context";
import { resolveEditWidget } from "../registry/edit";
import { resolveDisplayWidget } from "../registry/registry";
import { type DisplayWidgetProps, Empty, isCompact, Preview } from "./display";
import { type EditWidgetProps, UnsupportedInput } from "./edit";

interface ArrayMetaShape {
  readonly item?: Field;
  readonly min?: number;
  readonly max?: number;
}

/** Read an array value as the list it holds (anything else → empty). */
export function arrayItems(value: unknown): ReadonlyArray<unknown> {
  return Array.isArray(value) ? value : [];
}

/** Move `items[from]` to `to`, returning a new array. */
export function moveItem<T>(items: ReadonlyArray<T>, from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) next.splice(to, 0, moved);
  return next;
}

/**
 * Stable React keys for positional items. A list is edited by index, but keys
 * must survive a reorder so each row's widget keeps its state; this keeps a
 * parallel key list and mutates it alongside the value.
 */
export function useItemKeys(length: number) {
  const keys = useRef<string[]>([]);
  const counter = useRef(0);
  while (keys.current.length < length) keys.current.push(`k${counter.current++}`);
  if (keys.current.length > length) keys.current.length = length;
  return {
    keys: keys.current,
    add(): void {
      keys.current.push(`k${counter.current++}`);
    },
    remove(index: number): void {
      keys.current.splice(index, 1);
    },
    move(from: number, to: number): void {
      keys.current = moveItem(keys.current, from, to);
    },
  };
}

export function ArrayInput(props: EditWidgetProps): ReactNode {
  const meta = props.field.meta as ArrayMetaShape;
  const registry = useEditRegistry();
  const items = arrayItems(props.value);
  const itemKeys = useItemKeys(items.length);
  if (!meta.item) return <UnsupportedInput {...props} />;
  const item = meta.item;
  const Widget = resolveEditWidget(item.meta, registry);
  const atMax = meta.max !== undefined && items.length >= meta.max;
  const atMin = meta.min !== undefined && items.length <= meta.min;

  function emit(next: ReadonlyArray<unknown>): void {
    props.onChange(next.length === 0 ? undefined : [...next]);
  }

  return (
    <fieldset
      data-slot="array-input"
      id={props.id}
      aria-labelledby={props.labelId}
      aria-invalid={props.error ? true : undefined}
      disabled={props.disabled}
      className="min-w-0 space-y-2"
    >
      {items.map((entry, index) => {
        const rowId = `${props.id}-${index}`;
        const rowError = issueMessageAt(props.issues, [index]);
        return (
          <div key={itemKeys.keys[index]} data-slot="array-item" className="flex items-start gap-2">
            <span className="mt-2 w-6 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <Widget
                value={entry}
                onChange={(v) => {
                  const next = [...items];
                  next[index] = typeof v === "function" ? (v as (p: unknown) => unknown)(entry) : v;
                  emit(next);
                }}
                field={item}
                id={rowId}
                labelId={props.labelId}
                error={rowError}
                issues={issuesUnder(props.issues, index)}
                disabled={props.disabled}
              />
              {rowError ? (
                <p id={`${rowId}-error`} role="alert" className="text-destructive text-sm">
                  {rowError}
                </p>
              ) : null}
            </div>
            <span className="flex shrink-0 items-center">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Move item ${index + 1} up`}
                disabled={props.disabled || index === 0}
                onClick={() => {
                  itemKeys.move(index, index - 1);
                  emit(moveItem(items, index, index - 1));
                }}
              >
                <CaretUpIcon aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Move item ${index + 1} down`}
                disabled={props.disabled || index === items.length - 1}
                onClick={() => {
                  itemKeys.move(index, index + 1);
                  emit(moveItem(items, index, index + 1));
                }}
              >
                <CaretDownIcon aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={`Remove item ${index + 1}`}
                disabled={props.disabled || atMin}
                onClick={() => {
                  itemKeys.remove(index);
                  emit(items.filter((_, i) => i !== index));
                }}
              >
                <XIcon aria-hidden />
              </Button>
            </span>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        id={`${props.id}-add`}
        disabled={props.disabled || atMax}
        onClick={() => {
          itemKeys.add();
          emit([...items, item.meta.defaultValue]);
        }}
      >
        <PlusIcon aria-hidden />
        {atMax ? `Limit of ${meta.max} reached` : "Add item"}
      </Button>
    </fieldset>
  );
}

/** Read mode: scalars joined on dense surfaces, one rendered row per item in detail. */
export function ArrayDisplay({ value, meta, context }: DisplayWidgetProps): ReactNode {
  const items = arrayItems(value);
  const item = (meta as ArrayMetaShape).item;
  const registry = useDisplayRegistry();
  if (items.length === 0) return <Empty />;
  if (isCompact(context) || !item) {
    const scalars = items.filter((entry) => entry !== null && typeof entry !== "object");
    const text =
      scalars.length === items.length
        ? [
            ...scalars.slice(0, 3).map(String),
            ...(items.length > 3 ? [`+${items.length - 3}`] : []),
          ].join(", ")
        : `${items.length} item${items.length === 1 ? "" : "s"}`;
    return <Preview slot="array-display" text={text} />;
  }
  const Widget = resolveDisplayWidget(item.meta, registry);
  return (
    <ol
      data-slot="array-display"
      className={cn("space-y-1", items.length > 1 && "list-decimal pl-5")}
    >
      {items.map((entry, index) => (
        <li key={`${index}-${String(entry)}`} className="min-w-0">
          <Widget value={entry} meta={item.meta} context="detail" />
        </li>
      ))}
    </ol>
  );
}
