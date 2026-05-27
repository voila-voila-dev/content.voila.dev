import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type ZodTypeAny, z } from "zod";
import type { NumberField } from "../fields/number.ts";
import { type SelectField, selectValues } from "../fields/select.ts";
import type { SlugField } from "../fields/slug.ts";
import type { StringField } from "../fields/string.ts";
import type { AnyFieldDef } from "../types.ts";
import type { ValidatorAdapter } from "../validator.ts";

/** A slug segment: lowercase alphanumerics joined by single separators. */
function slugPattern(separator: string): RegExp {
  const s = separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^[a-z0-9]+(?:${s}[a-z0-9]+)*$`);
}

function buildString(field: StringField) {
  let schema = z.string();
  if (field.min !== undefined) schema = schema.min(field.min);
  if (field.max !== undefined) schema = schema.max(field.max);
  if (field.pattern) schema = schema.regex(field.pattern);
  if (field.format === "email") schema = schema.email();
  if (field.format === "url") schema = schema.url();
  if (field.format === "uuid") schema = schema.uuid();
  return schema;
}

function buildNumber(field: NumberField) {
  let schema = z.number();
  if (field.integer) schema = schema.int();
  if (field.min !== undefined) schema = schema.min(field.min);
  if (field.max !== undefined) schema = schema.max(field.max);
  if (field.step !== undefined) schema = schema.multipleOf(field.step);
  return schema;
}

function buildSelect(field: SelectField): ZodTypeAny {
  const values = selectValues(field);
  // An options-less select can't constrain anything; fall back to a plain
  // string so the schema stays buildable rather than throwing on an empty enum.
  if (values.length === 0) return z.string();
  return z.enum(values as [string, ...string[]]);
}

function buildSlug(field: SlugField): ZodTypeAny {
  return z.string().regex(slugPattern(field.separator ?? "-"));
}

function buildBase(field: AnyFieldDef): ZodTypeAny {
  switch (field.kind) {
    case "string":
      return buildString(field as StringField);
    case "number":
      return buildNumber(field as NumberField);
    case "boolean":
      return z.boolean();
    case "date":
      return z.iso.date();
    case "datetime":
      return z.iso.datetime({ offset: true });
    case "select":
      return buildSelect(field as SelectField);
    case "slug":
      return buildSlug(field as SlugField);
    case "json":
      return z.unknown();
    default:
      throw new Error(`zod adapter: unsupported field kind "${field.kind}"`);
  }
}

function applyEnvelope(field: AnyFieldDef, base: ZodTypeAny): ZodTypeAny {
  // Required fields validate the bare schema; a missing/empty value is an error.
  if (field.required) {
    return field.default !== undefined ? base.default(field.default) : base;
  }
  // Optional fields fold a blank control ("") into `undefined`, then fall back
  // to the default if one is declared. This mirrors the widgets, which emit
  // `undefined` for an empty control, so client and server validate the same
  // input identically (single source of truth) and an optional slug/select/
  // number no longer fails its constraint on "".
  //
  // `optional()` must precede `default()`: wrapped in `preprocess`, a bare
  // `default().optional()` short-circuits `undefined` away before the default
  // can fire, whereas `optional().default()` resolves `undefined` → default.
  let schema: ZodTypeAny = base.optional();
  if (field.default !== undefined) {
    schema = schema.default(field.default);
  }
  return z.preprocess((value) => (value === "" ? undefined : value), schema);
}

export const zodAdapter: ValidatorAdapter = (field): StandardSchemaV1 => {
  return applyEnvelope(field, buildBase(field));
};
