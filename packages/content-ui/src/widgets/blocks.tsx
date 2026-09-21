// Blocks widgets — the editor and reader for `fields.blocks({ types })`, the
// page-builder primitive. The editor is a list of collapsible cards, one per
// block: a header with a drag handle, the type badge, a one-line summary and
// move / remove controls, over the block's own fields (`NestedFields`, resolved
// through the registry in scope so injected media / relation / rich-text
// widgets work inside a block). The list shell — collapse, drag, move, forced
// open on error — is `SortableList`, shared with object arrays; this file adds
// the type badge and the "Add block" catalogue from `meta.types`. Emits a
// fresh array on every edit and `undefined` when the last block goes.

import { PlusIcon } from "@phosphor-icons/react";
import type { FieldsMap } from "@voila/content";
import { Badge } from "@voila.dev/ui/badge";
import { Button } from "@voila.dev/ui/button";
import { DropdownMenu } from "@voila.dev/ui/dropdown-menu";
import { type ReactNode, useRef } from "react";
import type { Doc } from "../lib/doc";
import { NamedIcon } from "../lib/icons";
import { recordSummary } from "../lib/text";
import { issuesUnder } from "../lib/validate";
import { NestedDisplayRows, NestedFields, visibleKeys } from "../nested-fields";
import { arrayItems, moveItem, useItemKeys } from "./array";
import { type DisplayWidgetProps, Empty, isCompact, Preview } from "./display";
import type { EditWidgetProps } from "./edit";
import { SortableList, type SortableListHandle } from "./sortable-list";

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
  return def ? recordSummary(block, def.fields) : undefined;
}

export function BlocksInput(props: EditWidgetProps): ReactNode {
  const meta = props.field.meta as BlocksMetaShape;
  const types = meta.types ?? {};
  const typeKeys = Object.keys(types);
  const blocks = blocksValue(props.value);
  const itemKeys = useItemKeys(blocks.length);
  const list = useRef<SortableListHandle>(null);

  const atMax = meta.max !== undefined && blocks.length >= meta.max;
  const atMin = meta.min !== undefined && blocks.length <= meta.min;

  function emit(next: ReadonlyArray<Block>): void {
    props.onChange(next.length === 0 ? undefined : [...next]);
  }
  function add(type: string): void {
    const def = types[type];
    if (!def) return;
    const index = blocks.length;
    itemKeys.add();
    const key = itemKeys.keys[index];
    emit([...blocks, blankBlock(type, def)]);
    const first = visibleKeys(def.fields)[0];
    if (key !== undefined) {
      list.current?.open(key, first === undefined ? undefined : `${props.id}-${index}-${first}`);
    }
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
      <SortableList
        ref={list}
        items={blocks}
        keys={itemKeys.keys}
        noun="block"
        idPrefix={props.id}
        issues={props.issues}
        disabled={props.disabled}
        atMin={atMin}
        rowData={(block) => ({ "data-block-type": blockType(block) })}
        header={(block) => {
          const type = blockType(block);
          const def = type === undefined ? undefined : types[type];
          const label =
            def?.label ?? (type === undefined ? "Block" : `Unknown block type “${type}”`);
          return {
            label,
            summary: blockSummary(block, def),
            badge: (
              <Badge variant="secondary" className="shrink-0 gap-1">
                {def?.icon ? <NamedIcon name={def.icon} className="size-3.5" /> : null}
                {label}
              </Badge>
            ),
          };
        }}
        body={(block, index) => {
          const type = blockType(block);
          const def = type === undefined ? undefined : types[type];
          return def ? (
            <NestedFields
              fields={def.fields}
              value={block}
              onChange={(next) => {
                const copy = [...blocks];
                copy[index] = { ...next, type };
                emit(copy);
              }}
              idPrefix={`${props.id}-${index}`}
              issues={issuesUnder(props.issues, index)}
              disabled={props.disabled}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              This block's type is no longer in the catalogue. Remove it or restore the type in the
              config.
            </p>
          );
        }}
        onMove={(from, to) => {
          itemKeys.move(from, to);
          emit(moveItem(blocks, from, to));
        }}
        onRemove={(index) => {
          itemKeys.remove(index);
          emit(blocks.filter((_, i) => i !== index));
        }}
      />
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
