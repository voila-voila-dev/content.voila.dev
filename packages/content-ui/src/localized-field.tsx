// LocalizedFieldEditor — the admin-translation editor for a localized field.
// A localized field's stored value is `Record<locale, T>`; this renders the
// *inner* field's edit widget once per project locale (resolved from the same
// registry the form uses) and merges each locale's edit back into the record.
// The locales come from the host (`config.i18n.locales`) — the narrowed field
// validator doesn't expose them at runtime.

import type { Field } from "@voila/content";
import { Badge } from "@voila/ui/badge";
import type { ReactNode } from "react";
import type { Doc } from "./lib/doc";
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
  /** id of the field's form label; each locale's widget is labelled by it plus
   *  the locale badge (`aria-labelledby`), e.g. "Published en". */
  readonly labelId?: string;
  readonly registry: EditRegistry;
  /**
   * Validation messages keyed by locale — the error renders (and `aria-invalid`
   * lights up) only under the locale(s) that actually failed, so a `fr` error no
   * longer flags `en` too. Locales absent from the map render clean.
   */
  readonly errors?: Readonly<Record<string, string>>;
  readonly disabled?: boolean;
}

function asRecord(value: unknown): Readonly<Doc> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Doc>)
    : {};
}

export function LocalizedFieldEditor({
  field,
  locales,
  value,
  onChange,
  id,
  labelId,
  registry,
  errors,
  disabled,
}: LocalizedFieldEditorProps): ReactNode {
  // The unwrapped per-locale value field; without it (a hand-built field) the
  // outer field is all we have — its widget edits the raw record.
  const inner = field.inner ?? field;
  const Widget = resolveEditWidget(inner.meta, registry);
  const record = asRecord(value);

  return (
    <div className="space-y-2">
      {locales.map((locale) => {
        const localeError = errors?.[locale];
        return (
          <div key={locale} className="flex items-start gap-2">
            <Badge
              id={`${id}-${locale}-label`}
              variant="outline"
              className="mt-1.5 shrink-0 font-mono text-xs"
            >
              {locale}
            </Badge>
            <div className="min-w-0 flex-1">
              <Widget
                value={record[locale]}
                // Merge via a functional updater (resolved by the host against
                // the latest record) so two locales emitting in the same batch —
                // each editor normalising on mount — don't overwrite each other.
                onChange={(v) => onChange((prev: unknown) => ({ ...asRecord(prev), [locale]: v }))}
                field={inner}
                id={`${id}-${locale}`}
                labelId={labelId ? `${labelId} ${id}-${locale}-label` : `${id}-${locale}-label`}
                error={localeError}
                disabled={disabled}
              />
              {localeError ? (
                <p
                  id={`${id}-${locale}-error`}
                  role="alert"
                  className="mt-1 text-sm text-destructive"
                >
                  {localeError}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
