// LocalizedFieldEditor — the admin-translation editor for a localized field.
// A localized field's stored value is `Record<locale, T>`; this renders the
// *inner* field's edit widget once per project locale (resolved from the same
// registry the form uses) and merges each locale's edit back into the record.
// The locales come from the host (`config.i18n.locales`) — the narrowed field
// validator doesn't expose them at runtime.

import type { Field } from "@voila/content";
import { Badge } from "@voila.dev/ui/badge";
import { cn } from "@voila.dev/ui/utils";
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
  /**
   * Render only this locale's editor instead of stacking every locale. This is
   * what the form's `LocaleSwitcher` drives; omit it and the editor keeps the
   * stacked layout (still the right shape for a two-locale field rendered on
   * its own, outside a form).
   */
  readonly activeLocale?: string;
  /**
   * The locale reads fall back to. When the active locale is empty and this one
   * has text, the fallback is shown greyed under the input — so a translator can
   * see what they are translating without leaving the field.
   */
  readonly fallbackLocale?: string;
}

/** Plain-text preview of a fallback value, for the translator hint. */
function previewText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (Array.isArray(value)) {
    const text = value.map(nodeText).join(" ").trim();
    return text === "" ? undefined : text;
  }
  return undefined;
}

function nodeText(node: unknown): string {
  if (node === null || typeof node !== "object") return "";
  const n = node as { text?: unknown; children?: unknown };
  if (typeof n.text === "string") return n.text;
  if (Array.isArray(n.children)) return n.children.map(nodeText).join("");
  return "";
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
  activeLocale,
  fallbackLocale,
}: LocalizedFieldEditorProps): ReactNode {
  // The unwrapped per-locale value field; without it (a hand-built field) the
  // outer field is all we have — its widget edits the raw record.
  const inner = field.inner ?? field;
  const Widget = resolveEditWidget(inner.meta, registry);
  const record = asRecord(value);
  // One locale at a time when the form drives a switcher; otherwise stacked.
  const shown =
    activeLocale !== undefined && locales.includes(activeLocale) ? [activeLocale] : locales;
  const single = shown.length === 1 && activeLocale !== undefined;

  return (
    <div className="space-y-2">
      {shown.map((locale) => {
        const localeError = errors?.[locale];
        // Show what this locale is a translation OF, when it's still empty.
        const fallback =
          fallbackLocale !== undefined &&
          fallbackLocale !== locale &&
          previewText(record[locale]) === undefined
            ? previewText(record[fallbackLocale])
            : undefined;
        return (
          <div key={locale} className="flex items-start gap-2">
            {/* The switcher already names the locale, so the per-row badge is
                redundant in single-locale mode — but it still has to exist for
                `aria-labelledby`, so it goes to screen readers only. */}
            <Badge
              id={`${id}-${locale}-label`}
              variant="outline"
              className={cn("mt-1.5 shrink-0 font-mono text-xs", single && "sr-only")}
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
              {fallback ? (
                <p className="mt-1 truncate text-muted-foreground text-xs">
                  <span className="font-mono">{fallbackLocale}</span>: {fallback}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
