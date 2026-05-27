import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { AnyFieldDef } from "./types.ts";
import { toValidator, type ValidatorAdapter } from "./validator.ts";

/** Per-field Standard Schema validators, keyed by field name. */
export type FieldValidators = Record<string, StandardSchemaV1>;

/**
 * Build one Standard Schema validator per field via `toValidator`, keyed by
 * field name. This is the single source of truth the form layer and the server
 * write path share: the client feeds each validator into its form library
 * (TanStack Form accepts a Standard Schema directly), and the server runs the
 * same set over an incoming payload. Swap `adapter` to validate with any
 * Standard Schema library — Zod is only the default the callers reach for.
 */
export function buildFieldValidators(
  fields: Record<string, AnyFieldDef>,
  adapter: ValidatorAdapter,
): FieldValidators {
  const validators: FieldValidators = {};
  for (const [name, field] of Object.entries(fields)) {
    validators[name] = toValidator(field, adapter);
  }
  return validators;
}

export type DocumentValidationResult =
  | { valid: true; value: Record<string, unknown> }
  | { valid: false; errors: Record<string, string[]> };

/** Run a single Standard Schema and normalize the outcome. */
async function runStandard(
  schema: StandardSchemaV1,
  value: unknown,
): Promise<{ ok: true; value: unknown } | { ok: false; messages: string[] }> {
  let result = schema["~standard"].validate(value);
  if (result instanceof Promise) result = await result;
  if (result.issues) {
    return { ok: false, messages: result.issues.map((issue) => issue.message) };
  }
  return { ok: true, value: result.value };
}

/**
 * Validate a whole document against a collection's fields. Returns the parsed
 * value (defaults applied, empty optionals dropped) on success, or per-field
 * error messages on failure. Only declared fields are considered; unknown input
 * keys are ignored rather than rejected.
 *
 * Runs the identical validators on the client (a pre-submit gate) and the
 * server (the write path), so the two can never disagree on what is valid.
 */
export async function validateDocument(
  fields: Record<string, AnyFieldDef>,
  input: unknown,
  adapter: ValidatorAdapter,
): Promise<DocumentValidationResult> {
  const validators = buildFieldValidators(fields, adapter);
  const source = (input ?? {}) as Record<string, unknown>;
  const value: Record<string, unknown> = {};
  const errors: Record<string, string[]> = {};

  for (const [name, schema] of Object.entries(validators)) {
    const result = await runStandard(schema, source[name]);
    if (result.ok) {
      // Drop `undefined` so optional/empty fields stay absent rather than
      // serializing a null column update.
      if (result.value !== undefined) value[name] = result.value;
    } else {
      errors[name] = result.messages;
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value };
}

/**
 * Validate a *partial* document — only the keys actually present in `input` are
 * checked, against the same per-field validators `validateDocument` uses. This
 * is the write path's `PATCH` semantics: an omitted field is left untouched, but
 * an explicitly-supplied value (including an invalid one for a required field)
 * is still validated. Unknown and system-column keys are ignored.
 *
 * Shares the field validators with `validateDocument`, so a `PATCH` can never
 * accept a value a `POST` would reject — the single source of truth holds across
 * full and partial writes alike.
 */
export async function validatePartialDocument(
  fields: Record<string, AnyFieldDef>,
  input: unknown,
  adapter: ValidatorAdapter,
): Promise<DocumentValidationResult> {
  const validators = buildFieldValidators(fields, adapter);
  const source = (input ?? {}) as Record<string, unknown>;
  const value: Record<string, unknown> = {};
  const errors: Record<string, string[]> = {};

  for (const [name, schema] of Object.entries(validators)) {
    // Only fields the caller actually sent participate in a partial update.
    if (!Object.hasOwn(source, name)) continue;
    const result = await runStandard(schema, source[name]);
    if (result.ok) {
      if (result.value !== undefined) value[name] = result.value;
    } else {
      errors[name] = result.messages;
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return { valid: true, value };
}
