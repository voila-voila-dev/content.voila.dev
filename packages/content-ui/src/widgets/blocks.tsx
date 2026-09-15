// Blocks widgets — the editor and reader for `fields.blocks({ types })`, the
// page-builder primitive. The editor is a list of collapsible cards, one per
// block: a header with a drag handle, the type badge, a one-line summary and
// move / remove controls, over the block's own fields (`NestedFields`, resolved
// through the registry in scope so injected media / relation / rich-text
// widgets work inside a block). "Add block" opens the catalogue from
// `meta.types`. Reordering is native HTML5 drag plus up / down buttons — the
// same dependency-free pattern as the column picker. Cards expand with a plain
// disclosure button (no height animation: a block's fields grow as items are
// added, which an animated panel would clip). Emits a fresh array on every
// edit and `undefined` when the last block goes.

import {
  CaretDownIcon,
  CaretUpIcon,
  DotsSixVerticalIcon,
  PlusIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { FieldsMap } from "@voila/content";
import { Badge } from "@voila.dev/ui/badge";
import { Button } from "@voila.dev/ui/button";
import { DropdownMenu } from "@voila.dev/ui/dropdown-menu";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useEffect, useState } from "react";
import type { Doc } from "../lib/doc";
import { NamedIcon } from "../lib/icons";
import { richTextToPlain, truncateText } from "../lib/text";
import { issuesUnder } from "../lib/validate";
import { NestedDisplayRows, NestedFields, visibleKeys } from "../nested-fields";
import { arrayItems, moveItem, useItemKeys } from "./array";
import { type DisplayWidgetProps, Empty, isCompact, Preview } from "./display";
import type { EditWidgetProps } from "./edit";

/** The per-type meta `fields.blocks` publishes (mirrors `BlockTypeMeta`). */
export interface BlockTypeShape {
  readonly label: string;
  readonly description?: string;
  readonly icon?: string;
  readonly fields: FieldsMap;
}

interface BlocksMetaShape {
  readonly types?: Readonly<Record<string, BlockTypeShape>>;
  readonly min?: number;
  readonly max?: number;
}

type Block = Readonly<Doc> & { readonly type?: unknown };

/** Read a blocks value as the list of records it holds (junk dropped). */
export function blocksValue(value: unknown): ReadonlyArray<Block> {
  return arrayItems(value).filter(
    (entry): entry is Block => typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
}

/** The block type key, when the block carries one. */
export function blockType(block: Block): string | undefined {
  return typeof block.type === "string" ? block.type : undefined;
}

/** A fresh block of `type`: the discriminator plus each field's `defaultValue`. */
export function blankBlock(type: string, def: BlockTypeShape): Block {
  const block: Record<string, unknown> = { type };
  for (const [key, field] of Object.entries(def.fields)) {
    if (field.meta.defaultValue !== undefined) block[key] = field.meta.defaultValue;
  }
  return block;
}

/**
 * One line that says what a collapsed block holds: the first non-empty
 * string / markdown / rich-text field, clipped. Nothing when the block is
 * still empty.
 */
export function blockSummary(block: Block, def: BlockTypeShape | undefined): string | undefined {
  if (!def) return undefined;
  for (const [key, field] of Object.entries(def.fields)) {
    const value = block[key];
    const kind = field.meta.kind;
    const text =
      kind === "richText" ? richTextToPlain(value) : typeof value === "string" ? value.trim() : "";
    if (text !== "") return truncateText(text, 80);
  }
  return undefined;
}

export function BlocksInput(props: EditWidgetProps): ReactNode {
  const meta = props.field.meta as BlocksMetaShape;
  const types = meta.types ?? {};
  const typeKeys = Object.keys(types);
  const blocks = blocksValue(props.value);
  const itemKeys = useItemKeys(blocks.length);
  // Which cards are expanded, by stable key. A card with a validation issue
  // is forced open so the message is visible.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  // Transient drag state for the visual cues; the reorder reads the source
  // index from the drag's dataTransfer so it is right even if a render lags.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  // A just-added block gets focus on its first control once it has rendered.
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  useEffect(() => {
    if (pendingFocus === null) return;
    document.getElementById(pendingFocus)?.focus();
    setPendingFocus(null);
  }, [pendingFocus]);

  const atMax = meta.max !== undefined && blocks.length >= meta.max;
  const atMin = meta.min !== undefined && blocks.length <= meta.min;

  function emit(next: ReadonlyArray<Block>): void {
    props.onChange(next.length === 0 ? undefined : [...next]);
  }
  function toggle(key: string, expanded: boolean): void {
    setOpen((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(key);
      else next.delete(key);
      return next;
    });
  }
  function add(type: string): void {
    const def = types[type];
    if (!def) return;
    const index = blocks.length;
    itemKeys.add();
    const key = itemKeys.keys[index];
    if (key !== undefined) toggle(key, true);
    emit([...blocks, blankBlock(type, def)]);
    const first = visibleKeys(def.fields)[0];
    if (first !== undefined) setPendingFocus(`${props.id}-${index}-${first}`);
  }
  function move(from: number, to: number): void {
    if (to < 0 || to >= blocks.length || from === to) return;
    itemKeys.move(from, to);
    emit(moveItem(blocks, from, to));
  }
  function remove(index: number): void {
    itemKeys.remove(index);
    emit(blocks.filter((_, i) => i !== index));
  }
  function drop(target: number, source: number | null): void {
    setDragIndex(null);
    setOverIndex(null);
    if (source === null || Number.isNaN(source)) return;
    move(source, target);
  }

  const addLabel = atMax ? `Limit of ${meta.max} reached` : "Add block";
  const addDisabled = props.disabled || atMax || typeKeys.length === 0;
  const singleType = typeKeys.length === 1 ? typeKeys[0] : undefined;

  return (
    <fieldset
      data-slot="blocks-input"
      id={props.id}
      aria-labelledby={props.labelId}
      aria-invalid={props.error ? true : undefined}
      disabled={props.disabled}
      // `min-w-0`: a fieldset's default `min-inline-size: min-content` would
      // let a wide nested field push the whole editor past the form column.
      className="min-w-0 space-y-2"
    >
      <ul className="space-y-2">
        {blocks.map((block, index) => {
          const key = itemKeys.keys[index] ?? String(index);
          const type = blockType(block);
          const def = type === undefined ? undefined : types[type];
          const issues = issuesUnder(props.issues, index);
          const invalid = issues.length > 0;
          const expanded = invalid || open.has(key);
          const summary = blockSummary(block, def);
          const label =
            def?.label ?? (type === undefined ? "Block" : `Unknown block type “${type}”`);
          const panelId = `${props.id}-${index}-panel`;
          return (
            <li
              key={key}
              data-slot="block"
              data-block-type={type}
              draggable={!props.disabled}
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
              <div data-slot="block-header" className="flex items-center gap-2 px-2 py-1.5">
                <DotsSixVerticalIcon
                  aria-hidden
                  className="size-4 shrink-0 cursor-grab text-muted-foreground"
                />
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={expanded ? panelId : undefined}
                  aria-label={`${expanded ? "Collapse" : "Expand"} block ${index + 1}: ${label}`}
                  onClick={() => toggle(key, !expanded)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    {def?.icon ? <NamedIcon name={def.icon} className="size-3.5" /> : null}
                    {label}
                  </Badge>
                  {summary ? (
                    <span className="min-w-0 truncate text-muted-foreground text-sm">
                      {summary}
                    </span>
                  ) : null}
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
                    aria-label={`Move block ${index + 1} up`}
                    disabled={props.disabled || index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <CaretUpIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Move block ${index + 1} down`}
                    disabled={props.disabled || index === blocks.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <CaretDownIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Remove block ${index + 1}`}
                    disabled={props.disabled || atMin}
                    onClick={() => remove(index)}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </span>
              </div>
              {expanded ? (
                <div id={panelId} className="border-t px-4 py-4">
                  {def ? (
                    <NestedFields
                      fields={def.fields}
                      value={block}
                      onChange={(next) => {
                        const copy = [...blocks];
                        copy[index] = { ...next, type };
                        emit(copy);
                      }}
                      idPrefix={`${props.id}-${index}`}
                      issues={issues}
                      disabled={props.disabled}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      This block's type is no longer in the catalogue. Remove it or restore the type
                      in the config.
                    </p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {singleType !== undefined ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          id={`${props.id}-add`}
          disabled={addDisabled}
          onClick={() => add(singleType)}
        >
          <PlusIcon aria-hidden />
          {addLabel}
        </Button>
      ) : (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            render={
              <Button
                type="button"
                size="sm"
                variant="outline"
                id={`${props.id}-add`}
                disabled={addDisabled}
              />
            }
          >
            <PlusIcon aria-hidden />
            {addLabel}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="start" className="min-w-56">
            {typeKeys.map((type) => {
              const def = types[type] as BlockTypeShape;
              return (
                <DropdownMenu.Item key={type} onClick={() => add(type)}>
                  {def.icon ? <NamedIcon name={def.icon} className="size-4" /> : null}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{def.label}</span>
                    {def.description ? (
                      <span className="truncate text-muted-foreground text-xs">
                        {def.description}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </fieldset>
  );
}

/** Read mode: `3 blocks: Hero, FAQ, CTA` on dense surfaces, cards in detail. */
export function BlocksDisplay({ value, meta, context }: DisplayWidgetProps): ReactNode {
  const types = (meta as BlocksMetaShape).types ?? {};
  const blocks = blocksValue(value);
  if (blocks.length === 0) return <Empty />;
  const labels = blocks.map((block) => {
    const type = blockType(block);
    return (type !== undefined && types[type]?.label) || type || "?";
  });
  if (isCompact(context)) {
    const shown = labels.slice(0, 3);
    const more = labels.length > 3 ? `, +${labels.length - 3}` : "";
    const count = `${blocks.length} block${blocks.length === 1 ? "" : "s"}`;
    return <Preview slot="blocks-display" text={`${count}: ${shown.join(", ")}${more}`} />;
  }
  return (
    <ol data-slot="blocks-display" className="space-y-3">
      {blocks.map((block, index) => {
        const type = blockType(block);
        const def = type === undefined ? undefined : types[type];
        return (
          <li key={`${index}-${labels[index]}`} className="rounded-md border p-3">
            <Badge variant="secondary" className="mb-2 gap-1">
              {def?.icon ? <NamedIcon name={def.icon} className="size-3.5" /> : null}
              {labels[index]}
            </Badge>
            {def ? <NestedDisplayRows fields={def.fields} value={block} /> : null}
          </li>
        );
      })}
    </ol>
  );
}
