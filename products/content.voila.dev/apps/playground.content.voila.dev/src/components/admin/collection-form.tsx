// VENDED by @voila/content-registry — you own this file.
// The create/edit form. Builds one labelled `FieldInput` per collection field,
// validates client-side against the **same `effect/Schema` the server runs**
// (`validateWrite`) so per-field errors show before submit, then writes through the
// CSRF-armed async client (`withWriteClient`). Server-side `ValidationError` /
// `ConflictError` are mapped back onto the fields / form.
import type { AsyncCollectionClient } from "@voila/content/client";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { type AnyDoc, fieldKeysFor, fieldMetaFor, validateWrite } from "~/lib/admin";
import { withWriteClient } from "~/lib/voila-write";
import { FieldInput } from "./field-input";

type Values = Record<string, unknown>;
type FieldErrors = Record<string, ReadonlyArray<string>>;

// A write-rejection shape — the async client rejects with the typed engine error.
interface WriteRejection {
  readonly _tag?: string;
  readonly fields?: FieldErrors;
  readonly field?: string | null;
  readonly message?: string;
}

const seedValues = (slug: string, initial?: AnyDoc): Values => {
  const values: Values = {};
  for (const key of fieldKeysFor(slug)) {
    if (initial && key in initial) {
      values[key] = initial[key];
    } else {
      const meta = fieldMetaFor(slug, key);
      values[key] = (meta?.widget ?? meta?.kind) === "boolean" ? false : undefined;
    }
  }
  return values;
};

export function CollectionForm({
  slug,
  id,
  initial,
  onSaved,
}: {
  readonly slug: string;
  readonly id?: string;
  readonly initial?: AnyDoc;
  readonly onSaved: (doc: AnyDoc) => void;
}) {
  const isEdit = id !== undefined;
  const [values, setValues] = useState<Values>(() => seedValues(slug, initial));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (name: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const validation = validateWrite(slug, values, isEdit);
    if (!validation.ok) {
      setFieldErrors(validation.fields);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const doc = await withWriteClient((client) => {
        const collection = (client as unknown as Record<string, AsyncCollectionClient<AnyDoc>>)[
          slug
        ];
        return isEdit
          ? collection.update({ id, data: values })
          : collection.create({ data: values });
      });
      onSaved(doc);
    } catch (error) {
      const rejection = error as WriteRejection;
      if (rejection._tag === "ValidationError" && rejection.fields) {
        setFieldErrors(rejection.fields);
      } else if (rejection._tag === "ConflictError") {
        setFormError(`${rejection.field ?? "A field"} must be unique.`);
      } else if (rejection._tag === "Unauthorized") {
        setFormError("Your session has expired — sign in again.");
      } else if (rejection._tag === "Forbidden") {
        setFormError("Security check failed — reload the page and try again.");
      } else {
        setFormError(rejection.message ?? "Save failed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-5">
          {fieldKeysFor(slug).map((key) => {
            const meta = fieldMetaFor(slug, key);
            const errors = fieldErrors[key] ?? [];
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`field-${key}`}>
                  {meta?.label ?? key}
                  {meta?.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                <FieldInput
                  slug={slug}
                  name={key}
                  value={values[key]}
                  disabled={submitting}
                  onChange={(value) => setField(key, value)}
                />
                {meta?.description ? (
                  <p className="text-xs text-muted-foreground">{meta.description}</p>
                ) : null}
                {errors.length > 0 ? (
                  <p className="text-xs text-destructive" data-testid={`error-${key}`}>
                    {errors.join(" ")}
                  </p>
                ) : null}
              </div>
            );
          })}

          {formError ? (
            <p className="text-sm text-destructive" data-testid="form-error">
              {formError}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
