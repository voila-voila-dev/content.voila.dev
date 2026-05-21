import type { StandardSchemaV1 } from "@standard-schema/spec";
import { type ZodTypeAny, z } from "zod";
import type { NumberField } from "../fields/number.ts";
import type { StringField } from "../fields/string.ts";
import type { AnyFieldDef } from "../types.ts";
import type { ValidatorAdapter } from "../validator.ts";

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
    case "json":
      return z.unknown();
    default:
      throw new Error(`zod adapter: unsupported field kind "${field.kind}"`);
  }
}

function applyEnvelope(field: AnyFieldDef, base: ZodTypeAny): ZodTypeAny {
  let schema = base;
  if (field.default !== undefined) {
    schema = schema.default(field.default);
  }
  if (!field.required) {
    schema = schema.optional();
  }
  return schema;
}

export const zodAdapter: ValidatorAdapter = (field): StandardSchemaV1 => {
  return applyEnvelope(field, buildBase(field));
};
