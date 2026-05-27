import { useForm, useStore } from "@tanstack/react-form";
import type { AnyFieldDef, ValidatorAdapter } from "@voila/content-schema";
import { buildFieldValidators, validateDocument } from "@voila/content-schema";
import { zodAdapter } from "@voila/content-schema/adapters/zod";
import { Alert } from "@voila/ui";
import { ArrowClockwiseIcon, WarningCircleIcon } from "@voila/ui/icons";
import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import type { FieldsRecord } from "../types.ts";
import { FormCard } from "./form-card.tsx";
import { FieldWidget } from "./widgets/field-widget.tsx";
import type { WidgetRegistry } from "./widgets/registry.ts";

/**
 * The admin edit form for a collection record. Drives TanStack Form, wiring one
 * `FieldWidget` per field with a per-field Standard Schema validator built from
 * `toValidator` (Zod by default, swappable via `adapter`).
 *
 * Validation is single-source-of-truth: the per-field validators feed live
 * field-level errors, and on submit the whole document is re-checked with the
 * very same `validateDocument` the server runs on the write path — so the two
 * can never disagree. `onSubmit` owns persistence; throwing surfaces a
 * form-level banner with retry, and a thrown `{ fields }` map (the shape the
 * server's `VALIDATION` envelope carries) lands back on the offending fields.
 */
export interface CollectionFormProps {
  /** Field definitions to render, in declaration order. */
  fields: FieldsRecord;
  /** Existing record values (edit mode). Omit for a blank create form. */
  initialValues?: Record<string, unknown>;
  /** Persist the validated document. Throw to signal failure (see above). */
  onSubmit: (value: Record<string, unknown>) => Promise<void> | void;
  /** Standard Schema adapter for the field validators. Defaults to Zod. */
  adapter?: ValidatorAdapter;
  /** Widget registry override (e.g. plugin widgets). */
  registry?: WidgetRegistry;
  /** Submit button label. Defaults to "Save". */
  submitLabel?: string;
}

export function CollectionForm({
  fields,
  initialValues,
  onSubmit,
  adapter = zodAdapter,
  registry,
  submitLabel = "Save",
}: CollectionFormProps) {
  const fieldEntries = useMemo(
    () =>
      (Object.entries(fields) as Array<[string, AnyFieldDef]>).filter(
        ([, field]) => field.hidden !== true,
      ),
    [fields],
  );
  const validators = useMemo(() => buildFieldValidators(fields, adapter), [fields, adapter]);
  const defaultValues = useMemo(() => {
    const values: Record<string, unknown> = {};
    for (const name of Object.keys(fields)) values[name] = initialValues?.[name];
    return values;
  }, [fields, initialValues]);

  // Server / submit failures live in React state rather than the form's error
  // map: they originate outside validation and clear on the next attempt.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      setServerErrors({});
      // Final gate with the same validator the server uses.
      const checked = await validateDocument(fields, value, adapter);
      if (!checked.valid) {
        setServerErrors(checked.errors);
        return;
      }
      try {
        await onSubmit(checked.value);
      } catch (error) {
        const fieldErrors = extractFieldErrors(error);
        if (fieldErrors) setServerErrors(fieldErrors);
        setSubmitError(submitMessage(error, fieldErrors !== null));
      }
    },
  });

  // Re-read on every change so derived widgets (slug ← title) see live siblings.
  const doc = useStore(form.store, (state) => state.values) as Record<string, unknown>;

  return (
    <FormCard.Root>
      <FormCard.Form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FormCard.Body className="grid gap-6">
          {submitError ? (
            <Alert.Root variant="destructive">
              <WarningCircleIcon />
              <Alert.Title>Couldn’t save</Alert.Title>
              <Alert.Description>{submitError}</Alert.Description>
            </Alert.Root>
          ) : null}

          {fieldEntries.map(([name, field]) => (
            <form.Field
              key={name}
              name={name}
              validators={{ onChange: validators[name], onBlur: validators[name] }}
            >
              {(fieldApi) => {
                const clientError = firstMessage(fieldApi.state.meta.errors);
                const error = clientError ?? serverErrors[name]?.[0];
                return (
                  <FieldWidget
                    name={name}
                    field={field}
                    value={fieldApi.state.value}
                    onChange={(next) => {
                      fieldApi.handleChange(next);
                      clearServerError(name, setServerErrors);
                    }}
                    onBlur={fieldApi.handleBlur}
                    error={error}
                    registry={registry}
                    doc={doc}
                  />
                );
              }}
            </form.Field>
          ))}
        </FormCard.Body>

        <FormCard.Footer>
          <FormCard.FooterDescription>
            {submitError ? "Saving failed — review and try again." : "Changes are saved on submit."}
          </FormCard.FooterDescription>
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
            {([canSubmit, isSubmitting]) =>
              submitError ? (
                <FormCard.Button type="submit" disabled={isSubmitting}>
                  <ArrowClockwiseIcon className="size-4" />
                  Retry
                </FormCard.Button>
              ) : (
                <FormCard.Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? "Saving…" : submitLabel}
                </FormCard.Button>
              )
            }
          </form.Subscribe>
        </FormCard.Footer>
      </FormCard.Form>
    </FormCard.Root>
  );
}

/** Pull the first human-readable message out of a field's error list. */
function firstMessage(errors: ReadonlyArray<unknown>): string | undefined {
  for (const entry of errors) {
    if (!entry) continue;
    if (typeof entry === "string") return entry;
    if (typeof entry === "object" && "message" in entry) {
      const message = (entry as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return undefined;
}

/**
 * Normalize a thrown submit error into a per-field map, if it carries one. The
 * server's `VALIDATION` envelope exposes `{ error: { fields } }`; an `ApiError`
 * surfaces it under `details.fields`; a plain object may carry `fields`
 * directly. Anything else is a form-level failure.
 */
function extractFieldErrors(error: unknown): Record<string, string[]> | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  const candidates = [
    record.fields,
    (record.details as Record<string, unknown> | undefined)?.fields,
    (record.error as Record<string, unknown> | undefined)?.fields,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const out: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(candidate)) {
        out[key] = Array.isArray(value) ? value.map(String) : [String(value)];
      }
      return out;
    }
  }
  return null;
}

function submitMessage(error: unknown, hasFieldErrors: boolean): string {
  if (hasFieldErrors) return "Some fields need attention. Review the highlighted fields and retry.";
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Something went wrong while saving. Please try again.";
}

function clearServerError(
  name: string,
  setServerErrors: Dispatch<SetStateAction<Record<string, string[]>>>,
) {
  setServerErrors((prev) => {
    if (!prev[name]) return prev;
    const { [name]: _cleared, ...rest } = prev;
    return rest;
  });
}
