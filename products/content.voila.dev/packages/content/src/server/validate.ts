/**
 * Server-side write validation. The future write endpoints (`POST`/`PATCH`,
 * separate roadmap item) call this before touching the database.
 *
 * It reuses the exact same `validateDocument` the admin form runs as its
 * client-side gate, so the two never disagree on what is valid — the single
 * source of truth lives in `@voila/content-schema` and is library-agnostic via
 * Standard Schema. Zod is only the default adapter; pass another to swap it.
 */

import type { AnyFieldDef, ValidatorAdapter } from "@voila/content-schema";
import { validateDocument } from "@voila/content-schema";
import { zodAdapter } from "@voila/content-schema/adapters/zod";
import type { Result } from "../shared/result.ts";
import { err, ok } from "../shared/result.ts";
import { type ValidationError, validationFailed } from "./errors.ts";

/** The slice of a collection write validation needs: its slug + field defs. */
export interface ValidatableCollection {
  slug: string;
  fields: Record<string, AnyFieldDef>;
}

/**
 * Validate an incoming write payload against a collection's fields. Returns the
 * parsed value (defaults applied, empty optionals dropped) on success, or a
 * `VALIDATION` failure carrying per-field messages — which `errorResponse`
 * serializes into the standard `{ error: { code, fields } }` envelope, ready
 * for the form to map back onto its fields.
 */
export async function validateWrite(
  collection: ValidatableCollection,
  input: unknown,
  adapter: ValidatorAdapter = zodAdapter,
): Promise<Result<Record<string, unknown>, ValidationError>> {
  const result = await validateDocument(collection.fields, input, adapter);
  if (result.valid) return ok(result.value);
  return err(validationFailed(collection.slug, result.errors));
}
