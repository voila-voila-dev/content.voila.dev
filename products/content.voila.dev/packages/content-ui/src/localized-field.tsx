// LocalizedFieldEditor — the admin-translation editor for a localized field.
// A localized field's stored value is `Record<locale, T>`; this renders the
// *inner* field's edit widget once per project locale (resolved from the same
// registry the form uses) and merges each locale's edit back into the record.
// The locales come from the host (`config.i18n.locales`) — the narrowed field
// validator doesn't expose them at runtime.

import type { Field } from "@voila/content";
import { Badge } from "@voila/ui";
import type { ReactNode } from "react";
import { type EditRegistry, resolveEditWidget } from "./registry/edit";

export interface LocalizedFieldEditorProps {
  /** The localized field as it appears in the collection (carries `inner`). */
  readonly field: Field;
  /** The project's locales, in display order (`config.i18n.locales`). */
  readonly locales: ReadonlyArray<string>;
  /** The per-locale record value (or nothing yet). */
  readonly value: unknown;
  readonly onChange: (value: unknown) => void;
  /** DOM id prefix; each locale's control gets `${id}-${locale}`. */
  readonly id: string;
  readonly registry: EditRegistry;
  readonly error?: string;
  readonly disabled?: boolean;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

export function LocalizedFieldEditor({
  field,
  locales,
  value,
  onChange,
  id,
  registry,
  error,
  disabled,
}: LocalizedFieldEditorProps): ReactNode {
  // The unwrapped per-locale value field; without it (a hand-built field) the
  // outer field is all we have — its widget edits the raw record.
  const inner = field.inner ?? field;
  const Widget = resolveEditWidget(inner.meta, registry);
  const record = asRecord(value);

  return (
    <div className="space-y-2">
      {locales.map((locale) => (
        <div key={locale} className="flex items-start gap-2">
          <Badge variant="outline" className="mt-1.5 shrink-0 font-mono text-xs">
            {locale}
          </Badge>
          <div className="min-w-0 flex-1">
            <Widget
              value={record[locale]}
              onChange={(v) => onChange({ ...record, [locale]: v })}
              field={inner}
              id={`${id}-${locale}`}
              error={error}
              disabled={disabled}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
