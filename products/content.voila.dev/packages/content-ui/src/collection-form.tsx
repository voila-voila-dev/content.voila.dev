// CollectionForm — builds a create/edit form from a collection's fields. Each
// field renders its edit widget (resolved from the registry); on submit the
// values are validated against the fields' Standard Schemas via `validateFields`
// (the same contract the REST write path enforces) and, only if clean, handed
// to `onSubmit` decoded. Field errors render inline; a form-level `error` slot
// surfaces server failures (e.g. a 409 conflict).

import type { Collection } from "@voila/content";
import { buttonVariants, cn, Label } from "@voila/ui";
import { type FormEvent, type ReactNode, useState } from "react";
import { humanize } from "./lib/humanize";
import { validateFields } from "./lib/validate";
import { defaultEditRegistry, type EditRegistry, resolveEditWidget } from "./registry/edit";

export interface CollectionFormProps {
  readonly collection: Collection;
  /** Initial field values (e.g. the document being edited). */
  readonly defaultValues?: Readonly<Record<string, unknown>>;
  /** Field keys to render, in order. Defaults to all non-hidden fields. */
  readonly fields?: ReadonlyArray<string>;
  /** Override edit widgets per kind/name. */
  readonly registry?: EditRegistry;
  /** Called with the decoded, validated values when the form is submitted. */
  readonly onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  readonly submitLabel?: string;
  /** Form-level error (e.g. a server conflict) shown above the submit button. */
  readonly error?: string;
}

function resolveFieldKeys(collection: Collection, fields?: ReadonlyArray<string>): string[] {
  if (fields) return fields.filter((k) => Object.hasOwn(collection.fields, k));
  return Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
}

export function CollectionForm({
  collection,
  defaultValues,
  fields,
  registry = defaultEditRegistry,
  onSubmit,
  submitLabel = "Save",
  error,
}: CollectionFormProps): ReactNode {
  const keys = resolveFieldKeys(collection, fields);
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...defaultValues }));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleChange(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
    // Clear a field's error as soon as the user edits it, so stale messages
    // don't linger while they fix the problem.
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const { [name]: _, ...rest } = prev;
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
      await onSubmit(result.values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {keys.map((key) => {
        const field = collection.fields[key];
        if (!field) return null;
        const Widget = resolveEditWidget(field.meta, registry);
        const id = `${collection.slug}-${key}`;
        const fieldError = errors[key];
        const required = field.meta.required === true;
        return (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={id}>
              {field.meta.label ?? humanize(key)}
              {required ? (
                <span aria-hidden className="ml-0.5 text-destructive">
                  *
                </span>
              ) : null}
            </Label>
            <Widget
              value={values[key]}
              onChange={(v) => handleChange(key, v)}
              field={field}
              id={id}
              error={fieldError}
              disabled={submitting}
            />
            {fieldError ? (
              <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}
          </div>
        );
      })}
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
