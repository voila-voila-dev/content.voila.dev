// Array widgets — the editor and reader for `fields.array(item)`. Two editors
// share the "Add item" button that respects `min` / `max`:
//
//   • scalars (strings, numbers, selects…) — an inline list of the item's own
//     widget, each row with move up / move down / remove;
//   • objects — collapsible cards (`SortableList`, the shell the blocks editor
//     uses) headed by a one-line summary, so a nav of nine `{label, href}`
//     links reads as nine rows instead of a wall of open forms.
//
// Emits a fresh array on every edit and `undefined` when the last item goes,
// so an optional list goes back to "not provided". Without `meta.item` (a
// bare-validator element) it degrades to the unsupported-input notice.

import { CaretDownIcon, CaretUpIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import type { Field, FieldsMap } from "@voila/content";
import { Button } from "@voila.dev/ui/button";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useRef } from "react";
import type { Doc } from "../lib/doc";
import { recordSummary } from "../lib/text";
import { issueMessageAt, issuesUnder } from "../lib/validate";
import { NestedDisplayRows, NestedFields, visibleKeys } from "../nested-fields";
import { useDisplayRegistry, useEditRegistry } from "../registry/context";
import { resolveEditWidget } from "../registry/edit";
import { resolveDisplayWidget } from "../registry/registry";
import { DisclosureRows } from "./disclosure-rows";
import { type DisplayWidgetProps, Empty, isCompact, Preview } from "./display";
import { type EditWidgetProps, UnsupportedInput } from "./edit";
import { SortableList, type SortableListHandle } from "./sortable-list";

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

/** The item's member map when the array holds objects (`fields.array(fields.object(...))`). */
function objectShape(item: Field | undefined): FieldsMap | undefined {
  if (!item || item.meta.kind !== "object") return undefined;
  const shape = (item.meta as { shape?: FieldsMap }).shape;
  return shape && Object.keys(shape).length > 0 ? shape : undefined;
}

function asRecord(value: unknown): Readonly<Doc> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Doc>)
    : {};
}

export function ArrayInput(props: EditWidgetProps): ReactNode {
  const meta = props.field.meta as ArrayMetaShape;
  const registry = useEditRegistry();
  const items = arrayItems(props.value);
  const itemKeys = useItemKeys(items.length);
  const list = useRef<SortableListHandle>(null);
  if (!meta.item) return <UnsupportedInput {...props} />;
  const item = meta.item;
  const shape = objectShape(item);
  const Widget = resolveEditWidget(item.meta, registry);
  const atMax = meta.max !== undefined && items.length >= meta.max;
  const atMin = meta.min !== undefined && items.length <= meta.min;

  function emit(next: ReadonlyArray<unknown>): void {
    props.onChange(next.length === 0 ? undefined : [...next]);
  }

  const addButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      id={`${props.id}-add`}
      disabled={props.disabled || atMax}
      onClick={() => {
        const index = items.length;
        itemKeys.add();
        emit([...items, item.meta.defaultValue]);
        if (shape) {
          const key = itemKeys.keys[index];
          const first = visibleKeys(shape)[0];
          if (key !== undefined) {
            list.current?.open(
              key,
              first === undefined ? undefined : `${props.id}-${index}-${first}`,
            );
          }
        }
      }}
    >
      <PlusIcon aria-hidden />
      {atMax ? `Limit of ${meta.max} reached` : "Add item"}
    </Button>
  );

  if (shape) {
    return (
      <fieldset
        data-slot="array-input"
        data-layout="cards"
        id={props.id}
        aria-labelledby={props.labelId}
        aria-invalid={props.error ? true : undefined}
        disabled={props.disabled}
        className="min-w-0 space-y-2"
      >
        <SortableList
          ref={list}
          items={items}
          keys={itemKeys.keys}
          noun="item"
          idPrefix={props.id}
          issues={props.issues}
          disabled={props.disabled}
          atMin={atMin}
          header={(entry, index) => ({
            label: `Item ${index + 1}`,
            summary: recordSummary(asRecord(entry), shape),
          })}
          body={(entry, index) => (
            <NestedFields
              fields={shape}
              value={asRecord(entry)}
              onChange={(next) => {
                const copy = [...items];
                copy[index] = next;
                emit(copy);
              }}
              idPrefix={`${props.id}-${index}`}
              issues={issuesUnder(props.issues, index)}
              disabled={props.disabled}
            />
          )}
          onMove={(from, to) => {
            itemKeys.move(from, to);
            emit(moveItem(items, from, to));
          }}
          onRemove={(index) => {
            itemKeys.remove(index);
            emit(items.filter((_, i) => i !== index));
          }}
        />
        {addButton}
      </fieldset>
    );
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
      {addButton}
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
  // Records read as the editor's collapsed rows (summary + disclosure), so a
  // list of links or steps is scannable; scalars stay a plain list.
  const shape =
    item.meta.kind === "object" ? (item.meta as { shape?: FieldsMap }).shape : undefined;
  if (shape) {
    return (
      <DisclosureRows
        slot="array-display"
        rows={items.map((entry, index) => {
          const record =
            typeof entry === "object" && entry !== null && !Array.isArray(entry)
              ? (entry as Readonly<Doc>)
              : {};
          return {
            key: `${index}-${recordSummary(record, shape) ?? ""}`,
            summary: recordSummary(record, shape) ?? `Item ${index + 1}`,
            body: <NestedDisplayRows fields={shape} value={record} />,
          };
        })}
      />
    );
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
