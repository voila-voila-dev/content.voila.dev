// Multi-select widgets — the editor and reader for
// `fields.multiSelect({ options: [...] })`.
//
// Unlike `relation`, every option is already in the field's metadata, so these
// need no injected loader. The editor is a chip combobox: type to filter, Enter
// to add, Backspace or the chip's × to remove. The value emitted is the plain
// `string[]` the field's own schema validates, or `undefined` when the last
// chip is removed (so an optional field goes back to "not provided" rather than
// storing an empty array).

import { Badge } from "@voila.dev/ui/badge";
import { Combobox } from "@voila.dev/ui/combobox";
import type { ReactNode } from "react";
import { useMessages } from "../lib/messages";
import { type DisplayWidgetProps, Empty, isCompact } from "./display";
import type { EditWidgetProps } from "./edit";

interface MultiSelectMetaShape {
  readonly options?: ReadonlyArray<string>;
  readonly max?: number;
}

/** Read a multi-select value as the string list it holds. */
export function multiSelectValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function MultiSelectInput({
  value,
  onChange,
  id,
  error,
  disabled,
  field,
}: EditWidgetProps): ReactNode {
  const meta = field.meta as MultiSelectMetaShape;
  const options = meta.options ?? [];
  const selected = multiSelectValues(value);
  // At the cap the picker still shows what's chosen but offers nothing more, so
  // the limit is felt in the UI rather than only at validation time.
  const atMax = meta.max !== undefined && selected.length >= meta.max;
  const m = useMessages().form;
  const available = atMax ? [] : options;
  return (
    <Combobox.Root
      items={available}
      multiple
      value={selected}
      disabled={disabled}
      onValueChange={(next: ReadonlyArray<string>) =>
        onChange(next.length === 0 ? undefined : [...next])
      }
    >
      <Combobox.Chips data-slot="multi-select-input" className="w-full">
        {selected.map((option) => (
          <Combobox.Chip key={option} aria-label={option}>
            {option}
          </Combobox.Chip>
        ))}
        <Combobox.ChipsInput
          id={id}
          placeholder={atMax ? m.limitReached(meta.max ?? 0) : m.multiSelectAdd}
          aria-invalid={error ? true : undefined}
          aria-required={field.meta.required === true ? true : undefined}
        />
      </Combobox.Chips>
      <Combobox.Content>
        <Combobox.Empty>{atMax ? `${m.limitReached(meta.max ?? 0)}.` : m.noMatch}</Combobox.Empty>
        <Combobox.List>
          {(option: string) => (
            <Combobox.Item key={option} value={option}>
              {option}
            </Combobox.Item>
          )}
        </Combobox.List>
      </Combobox.Content>
    </Combobox.Root>
  );
}

/** Read mode: one quiet chip per value, truncated to two on dense surfaces. */
export function MultiSelectDisplay({ value, context }: DisplayWidgetProps): ReactNode {
  const values = multiSelectValues(value);
  if (values.length === 0) return <Empty />;
  const compact = isCompact(context);
  const shown = compact ? values.slice(0, 2) : values;
  return (
    <span data-slot="multi-select-display" className="inline-flex flex-wrap items-center gap-1">
      {shown.map((v) => (
        <Badge key={v} variant="secondary" className="whitespace-nowrap">
          {v}
        </Badge>
      ))}
      {compact && values.length > shown.length ? (
        <span className="text-muted-foreground text-xs">+{values.length - shown.length}</span>
      ) : null}
    </span>
  );
}
