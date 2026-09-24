// StatusControl — the record's editorial state, in the header where it belongs.
//
// Most projects model editorial state as an `enum` field (Draft / In review /
// Published), which the admin used to render as one dropdown buried inside
// whichever field group happened to contain it. So the single most important
// fact about a record — is this live? — was invisible from its page, and
// changing it took four clicks through Edit mode.
//
// This reads the collection's status field straight from the config, shows its
// current value as a toned pill next to the title, and changes it with one
// PATCH. Nothing to configure: any `enum` field named `status` (or the only
// `enum` field on the collection) becomes the header control.
//
// Collections using the engine's `drafts: true` feature keep `PublishControls`
// instead — that has real publish/unpublish semantics and a scheduled state.

import { CaretDownIcon } from "@phosphor-icons/react";
import type { Collection, Field } from "@voila/content";
import { type Doc, EnumDisplay, useMessages } from "@voila/content-ui";
import { Button } from "@voila.dev/ui/button";
import { DropdownMenu } from "@voila.dev/ui/dropdown-menu";
import type { ReactNode } from "react";

/** The field that carries editorial state, if the collection has one. */
export function statusField(
  collection: Collection,
): { readonly name: string; readonly field: Field } | undefined {
  const enums = Object.entries(collection.fields).filter(([, field]) => field.meta.kind === "enum");
  if (enums.length === 0) return undefined;
  // A field actually named `status` wins; otherwise a lone enum is unambiguous
  // enough to treat as the status. Two unnamed enums are ambiguous — leave them
  // in the form rather than guessing wrong in the header.
  const named = enums.find(([name]) => name.toLowerCase() === "status");
  const picked = named ?? (enums.length === 1 ? enums[0] : undefined);
  if (picked === undefined) return undefined;
  return { name: picked[0], field: picked[1] };
}

/** Label → stored value pairs for an enum field, in config order. */
function enumEntries(field: Field): Array<[string, string | number]> {
  const values = (field.meta as { values?: Record<string, string | number> }).values ?? {};
  return Object.entries(values);
}

/** The human label for the value currently stored. */
function currentLabel(field: Field, value: unknown): string | undefined {
  const hit = enumEntries(field).find(([, raw]) => String(raw) === String(value));
  return hit?.[0];
}

export interface StatusControlProps {
  readonly collection: Collection;
  readonly doc: Doc;
  readonly disabled?: boolean;
  /** Applies the new stored value as a one-field patch. */
  readonly onChange: (values: Doc) => void;
}

export function StatusControl({
  collection,
  doc,
  disabled,
  onChange,
}: StatusControlProps): ReactNode {
  const m = useMessages().admin;
  const status = statusField(collection);
  if (status === undefined) return null;
  const entries = enumEntries(status.field);
  if (entries.length === 0) return null;
  const value = doc[status.name];
  const label = currentLabel(status.field, value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 px-1.5"
            aria-label={label ? m.statusIs(label) : m.setStatus}
          />
        }
      >
        {label ? (
          <EnumDisplay value={value} meta={status.field.meta} />
        ) : (
          <span className="text-muted-foreground">{m.setStatus}</span>
        )}
        <CaretDownIcon aria-hidden className="text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {entries.map(([optionLabel, raw]) => (
          <DropdownMenu.Item
            key={optionLabel}
            disabled={String(raw) === String(value)}
            onClick={() => onChange({ [status.name]: raw } as Doc)}
          >
            <EnumDisplay value={raw} meta={status.field.meta} />
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
