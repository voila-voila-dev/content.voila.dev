// CollectionForm — builds a create/edit form from a collection's fields. Each
// field renders its edit widget (resolved from the registry); on submit the
// values are validated against the fields' Standard Schemas via `validateFields`
// (the same contract the REST write path enforces) and, only if clean, handed
// to `onSubmit` decoded. Field errors render inline; a form-level `error` slot
// surfaces server failures (e.g. a 409 conflict).

import { type Collection, type InferFields, slugify } from "@voila/content";
import { buttonVariants, cn, Label } from "@voila/ui";
import { type FormEvent, type ReactNode, useState } from "react";
import type { Doc } from "./lib/doc";
import { getFieldLabel, humanize } from "./lib/humanize";
import { validateFields } from "./lib/validate";
import { LocalizedFieldEditor } from "./localized-field";
import { defaultEditRegistry, type EditRegistry, resolveEditWidget } from "./registry/edit";

/**
 * The typed document shape for a collection's fields — what `onSubmit` receives
 * once the form has validated. When `collection` is a config-inferred
 * `Collection<Slug, Fields>` this resolves to the exact per-field types (so the
 * host can hand the values straight to `client.<slug>.create`/`update` with no
 * cast); an untyped runtime `Collection` falls back to the loose `Doc`.
 */
export type FormValues<C extends Collection> =
  C extends Collection<string, infer Fields> ? InferFields<Fields> : Doc;

export interface CollectionFormProps<C extends Collection = Collection> {
  readonly collection: C;
  /**
   * Initial field values (e.g. the document being edited). Loosely typed on
   * purpose — a fetched document carries extra fields (`id`, timestamps) and a
   * new-document form may seed only some — so this is the erased `Doc`, while
   * the validated `onSubmit` output is the precise `FormValues<C>`.
   */
  readonly defaultValues?: Readonly<Doc>;
  /** Field keys to render, in order. Defaults to all non-hidden fields. */
  readonly fields?: ReadonlyArray<string>;
  /** Override edit widgets per kind/name. */
  readonly registry?: EditRegistry;
  /**
   * The project's locales (`config.i18n.locales`). When set, localized fields
   * render one input per locale (admin translation); without it they fall back
   * to the kind's plain widget editing the raw record.
   */
  readonly locales?: ReadonlyArray<string>;
  /** Called with the decoded, validated values when the form is submitted. */
  readonly onSubmit: (values: FormValues<C>) => void | Promise<void>;
  readonly submitLabel?: string;
  /** Form-level error (e.g. a server conflict) shown above the submit button. */
  readonly error?: string;
  /**
   * Server-side field errors keyed by field name — the shape
   * `ContentClientError.issuesByField()` produces from a 422 `VALIDATION` or
   * 409 `CONFLICT` envelope. Each new object is adopted into the form's field
   * errors, so they render inline and clear as the user edits (like local
   * validation); keys without a rendered field surface in the form-level slot.
   */
  readonly serverErrors?: Readonly<Record<string, string>>;
}

function resolveFieldKeys(collection: Collection, fields?: ReadonlyArray<string>): string[] {
  if (fields) return fields.filter((k) => Object.hasOwn(collection.fields, k));
  return Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
}

interface SlugDerivations {
  /** Source field key → the slug field keys that derive from it. */
  readonly bySource: Readonly<Record<string, ReadonlyArray<string>>>;
  /** Every slug field key that has a `from` source. */
  readonly derivable: ReadonlySet<string>;
}

// `slug({ from: "title" })` wiring: which rendered slug fields follow which
// source field. Localized slugs are excluded — per-locale derivation isn't
// supported.
function slugDerivations(collection: Collection, keys: ReadonlyArray<string>): SlugDerivations {
  const bySource: Record<string, string[]> = {};
  const derivable = new Set<string>();
  for (const key of keys) {
    const meta = collection.fields[key]?.meta as
      | { kind: string; localized?: boolean; from?: string }
      | undefined;
    if (meta?.kind !== "slug" || typeof meta.from !== "string" || meta.localized === true) continue;
    bySource[meta.from] = [...(bySource[meta.from] ?? []), key];
    derivable.add(key);
  }
  return { bySource, derivable };
}

export function CollectionForm<C extends Collection = Collection>({
  collection,
  defaultValues,
  fields,
  registry = defaultEditRegistry,
  locales,
  onSubmit,
  submitLabel = "Save",
  error,
  serverErrors,
}: CollectionFormProps<C>): ReactNode {
  const keys = resolveFieldKeys(collection, fields);
  const { bySource, derivable } = slugDerivations(collection, keys);
  // Internally the form edits a loose record (widgets are kind-keyed, not
  // field-typed); the typed `FormValues<C>` surface lives only at the
  // `onSubmit` boundary, narrowed back once `validateFields` has run.
  const defaults = defaultValues ?? {};
  const [values, setValues] = useState<Doc>(() => ({ ...defaults }));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>(() => ({
    ...serverErrors,
  }));
  const [submitting, setSubmitting] = useState(false);
  // Adopt each new `serverErrors` object into the field errors during render
  // (the React "derive state from a prop change" pattern), so a failed submit's
  // 422/409 lands on the offending fields and clears on edit like local errors.
  const [prevServerErrors, setPrevServerErrors] = useState(serverErrors);
  if (serverErrors !== prevServerErrors) {
    setPrevServerErrors(serverErrors);
    if (serverErrors !== undefined) setErrors((prev) => ({ ...prev, ...serverErrors }));
  }
  // Derive-on-type latch: a slug follows its `from` source until it's edited
  // by hand — including arriving non-empty (an existing document). Clearing
  // the slug re-opens the latch so the next source edit re-derives.
  const [latchedSlugs, setLatchedSlugs] = useState<ReadonlySet<string>>(() => {
    const latched = new Set<string>();
    for (const key of derivable) {
      const v = defaults[key];
      if (typeof v === "string" && v !== "") latched.add(key);
    }
    return latched;
  });

  function handleChange(name: string, value: unknown) {
    const derivedKeys = (bySource[name] ?? []).filter((k) => !latchedSlugs.has(k));
    setValues((prev) => {
      // A localized widget passes a functional updater so its per-locale edits
      // merge against the latest record, not the (possibly stale) value it was
      // rendered with — otherwise two locales emitting in one batch clobber each
      // other and a locale silently drops out of the record.
      const resolved =
        typeof value === "function" ? (value as (p: unknown) => unknown)(prev[name]) : value;
      const next = { ...prev, [name]: resolved };
      if (typeof resolved === "string") for (const k of derivedKeys) next[k] = slugify(resolved);
      return next;
    });
    if (derivable.has(name)) {
      setLatchedSlugs((prev) => {
        const latch = value !== "" && value !== undefined && value !== null;
        if (latch === prev.has(name)) return prev;
        const next = new Set(prev);
        if (latch) next.add(name);
        else next.delete(name);
        return next;
      });
    }
    // Clear a field's error as soon as the user edits it (and any slug just
    // re-derived from it), so stale messages don't linger while they fix the
    // problem.
    setErrors((prev) => {
      const stale = [name, ...derivedKeys].filter((k) => k in prev);
      if (stale.length === 0) return prev;
      const rest = { ...prev };
      for (const k of stale) delete rest[k];
      return rest;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateFields(collection.fields, values, keys);
    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // `result.values` has cleared the fields' Standard Schemas, so it
      // conforms to the collection's typed shape — narrow back to `FormValues`.
      await onSubmit(result.values as FormValues<C>);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {keys.map((key) => {
        const field = collection.fields[key];
        if (!field) return null;
        const id = `${collection.slug}-${key}`;
        const fieldError = errors[key];
        const required = field.meta.required === true;
        const localized = field.meta.localized === true && locales !== undefined;
        const Widget = localized ? null : resolveEditWidget(field.meta, registry);
        return (
          <div key={key} className="space-y-1.5">
            <Label id={`${id}-label`} htmlFor={localized ? `${id}-${locales?.[0]}` : id}>
              {getFieldLabel(key, field)}
              {required ? (
                <span aria-hidden className="ml-0.5 text-destructive">
                  *
                </span>
              ) : null}
            </Label>
            {localized ? (
              <LocalizedFieldEditor
                field={field}
                locales={locales ?? []}
                value={values[key]}
                onChange={(v) => handleChange(key, v)}
                id={id}
                labelId={`${id}-label`}
                registry={registry}
                error={fieldError}
                disabled={submitting}
              />
            ) : Widget ? (
              <Widget
                value={values[key]}
                onChange={(v) => handleChange(key, v)}
                field={field}
                id={id}
                labelId={`${id}-label`}
                error={fieldError}
                disabled={submitting}
              />
            ) : null}
            {fieldError ? (
              <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}
          </div>
        );
      })}
      {/* Errors keyed to a field the form doesn't render (a conflict on a
          hidden field, say) must still be visible — show them form-level. */}
      {Object.entries(errors)
        .filter(([key]) => !keys.includes(key))
        .map(([key, message]) => (
          <p key={key} role="alert" className="text-sm text-destructive">
            {humanize(key)}: {message}
          </p>
        ))}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {/* A native submit button so pressing Enter / clicking submits the form;
          styled with the @voila/ui button tokens. */}
      <button type="submit" disabled={submitting} className={cn(buttonVariants())}>
        {submitLabel}
      </button>
    </form>
  );
}
