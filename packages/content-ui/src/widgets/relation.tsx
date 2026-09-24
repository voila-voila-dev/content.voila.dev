// Relation widgets — the editor for `fields.relation({ to: "people" })`.
//
// A relation points at a row in ANOTHER collection, so unlike every other
// widget these can't render from the value alone: `"c1f4…fc35"` means nothing to
// an editor. They need to look the target up. `@voila/content-ui` stays
// presentational and router/fetch-agnostic, so the lookup arrives as an injected
// `RelationLoader` — the same shape as `createGeoInput`'s map config. The
// config-driven admin wires a real loader from its typed client; a consumer
// using `CollectionForm` directly can pass their own (or none, and get the
// honest id fallback).
//
// Options are fetched once per target collection and filtered in the browser by
// the combobox — the right trade for the collection sizes an admin picker is
// usable at, and `RELATION_OPTION_LIMIT` keeps a runaway collection from
// flooding the popup.

import { Badge } from "@voila.dev/ui/badge";
import { Button } from "@voila.dev/ui/button";
import { Combobox } from "@voila.dev/ui/combobox";
import { Input } from "@voila.dev/ui/input";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useMessages } from "../lib/messages";
import { type DisplayWidgetProps, Empty, isCompact } from "./display";
import type { EditWidget, EditWidgetProps } from "./edit";

/** One pickable row in the target collection. */
export interface RelationOption {
  /** The target document's id — what gets stored in the field. */
  readonly value: string;
  /** The target's title field, or a readable stand-in. */
  readonly label: string;
  /** Optional secondary line (a role, a year) shown under the label. */
  readonly hint?: string;
}

/**
 * Fetches the pickable rows of a target collection. Called with the slug from
 * the field's `meta.to`. Rejecting is fine — the widget degrades to the id
 * input rather than breaking the form.
 */
export type RelationLoader = (collection: string) => Promise<ReadonlyArray<RelationOption>>;

export interface RelationWidgetOptions {
  readonly load: RelationLoader;
  /** Cap on options held in the picker. Defaults to 500. */
  readonly limit?: number;
}

const RELATION_OPTION_LIMIT = 500;

interface RelationMetaShape {
  readonly to?: string;
  readonly many?: boolean;
}

/** Read a relation value as the list of ids it holds, whatever its arity. */
export function relationIds(value: unknown): string[] {
  if (typeof value === "string") return value === "" ? [] : [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

/** The label for an id, falling back to a shortened id while options load. */
function optionLabel(options: ReadonlyArray<RelationOption>, id: string): string {
  return options.find((o) => o.value === id)?.label ?? shortId(id);
}

/** `c1f4…fc35` — enough of an id to recognise, short enough to sit in a cell. */
export function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

/**
 * Shared "load this collection's options once" hook. Keyed by collection slug,
 * so switching fields inside one form doesn't refetch what's already resolved.
 * A failed load leaves `options` empty and flips `failed`, which is what makes
 * the widget fall back to the id input instead of showing an empty picker.
 */
function useRelationOptions(
  collection: string | undefined,
  load: RelationLoader,
  limit: number,
): { options: ReadonlyArray<RelationOption>; loading: boolean; failed: boolean } {
  const [options, setOptions] = useState<ReadonlyArray<RelationOption>>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  // `load` is usually an inline closure; holding it in a ref keeps it out of the
  // effect's deps so the fetch runs once per collection, not once per render.
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (collection === undefined) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadRef
      .current(collection)
      .then((rows) => {
        if (cancelled) return;
        setOptions(rows.slice(0, limit));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collection, limit]);
  return { options, loading, failed };
}

/**
 * The honest fallback: edit the target's id by hand. Used when no loader is
 * injected, or when the loader failed — better than a picker that can never
 * offer anything.
 */
export function RelationIdInput({
  value,
  onChange,
  id,
  disabled,
  error,
}: EditWidgetProps): ReactNode {
  const ids = relationIds(value);
  const m = useMessages().form;
  return (
    <Input
      data-slot="relation-id-input"
      id={id}
      value={ids.join(", ")}
      placeholder={m.documentId}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      onChange={(e) => {
        const raw = e.target.value.trim();
        onChange(raw === "" ? undefined : raw);
      }}
    />
  );
}

/**
 * Build the relation edit widget around a loader. Single relations render a
 * searchable combobox with a clear button; `many: true` renders removable chips.
 */
export function createRelationInput(config: RelationWidgetOptions): EditWidget {
  const limit = config.limit ?? RELATION_OPTION_LIMIT;
  return function RelationInput(props: EditWidgetProps): ReactNode {
    const meta = props.field.meta as RelationMetaShape;
    const target = meta.to;
    const many = meta.many === true;
    const { options, loading, failed } = useRelationOptions(target, config.load, limit);
    const ids = relationIds(props.value);
    const messages = useMessages();

    if (target === undefined || failed) return <RelationIdInput {...props} />;

    const placeholder = loading ? messages.common.loading : messages.form.searchIn(target);

    if (many) {
      const selected = ids.map((v) => ({ value: v, label: optionLabel(options, v) }));
      return (
        <Combobox.Root
          items={options}
          multiple
          value={selected}
          disabled={props.disabled}
          onValueChange={(next: ReadonlyArray<RelationOption>) =>
            props.onChange(next.length === 0 ? undefined : next.map((o) => o.value))
          }
          isItemEqualToValue={(a: RelationOption, b: RelationOption) => a.value === b.value}
        >
          <Combobox.Chips data-slot="relation-input" className={cn("w-full")}>
            {selected.map((option) => (
              <Combobox.Chip key={option.value} aria-label={option.label}>
                {option.label}
              </Combobox.Chip>
            ))}
            <Combobox.ChipsInput id={props.id} placeholder={placeholder} />
          </Combobox.Chips>
          <Combobox.Content>
            <Combobox.Empty>
              {loading ? messages.common.loading : messages.form.nothingMatches(target)}
            </Combobox.Empty>
            <Combobox.List>
              {(option: RelationOption) => (
                <Combobox.Item key={option.value} value={option}>
                  <OptionRow option={option} />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
      );
    }

    const currentId = ids[0];
    const current =
      currentId === undefined ? null : { value: currentId, label: optionLabel(options, currentId) };
    return (
      <div data-slot="relation-input" className="flex items-center gap-2">
        <Combobox.Root
          items={options}
          value={current}
          disabled={props.disabled}
          onValueChange={(next: RelationOption | null) => props.onChange(next?.value ?? undefined)}
          isItemEqualToValue={(a: RelationOption, b: RelationOption) => a.value === b.value}
        >
          <Combobox.Input
            id={props.id}
            placeholder={placeholder}
            aria-invalid={props.error ? true : undefined}
            className="w-full"
          />
          <Combobox.Content>
            <Combobox.Empty>
              {loading ? messages.common.loading : messages.form.nothingMatches(target)}
            </Combobox.Empty>
            <Combobox.List>
              {(option: RelationOption) => (
                <Combobox.Item key={option.value} value={option}>
                  <OptionRow option={option} />
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Content>
        </Combobox.Root>
        {currentId !== undefined && !props.disabled ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => props.onChange(undefined)}
            aria-label={messages.form.clearSelection}
          >
            {messages.form.clear}
          </Button>
        ) : null}
      </div>
    );
  };
}

function OptionRow({ option }: { readonly option: RelationOption }): ReactNode {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{option.label}</span>
      {option.hint ? (
        <span className="truncate text-muted-foreground text-xs">{option.hint}</span>
      ) : null}
    </span>
  );
}

/**
 * Read-mode relation. Same injection story as the input: without a resolver a
 * relation can only honestly show a shortened id, so the loader is what turns
 * it into the target's title.
 */
export function createRelationDisplay(config: RelationWidgetOptions) {
  const limit = config.limit ?? RELATION_OPTION_LIMIT;
  return function RelationDisplay({ value, meta, context }: DisplayWidgetProps): ReactNode {
    const target = (meta as RelationMetaShape).to;
    const { options } = useRelationOptions(target, config.load, limit);
    const ids = relationIds(value);
    if (ids.length === 0) return <Empty />;
    const compact = isCompact(context);
    return (
      <span data-slot="relation-display" className="inline-flex flex-wrap items-center gap-1">
        {(compact ? ids.slice(0, 2) : ids).map((id) => (
          <Badge key={id} variant="secondary" className="max-w-[16rem] truncate">
            {optionLabel(options, id)}
          </Badge>
        ))}
        {compact && ids.length > 2 ? (
          <span className="text-muted-foreground text-xs">+{ids.length - 2}</span>
        ) : null}
      </span>
    );
  };
}
