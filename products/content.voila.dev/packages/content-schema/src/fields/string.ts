// `string` field — annotated effect/Schema for a UTF-8 text value.

import { Schema } from "effect";
import type { StringFieldMeta } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export interface StringFieldOpts {
  readonly min?: number;
  readonly max?: number;
  readonly unique?: boolean;
  readonly required?: boolean;
  readonly label?: string;
  readonly description?: string;
  readonly default?: string;
  readonly localized?: boolean;
}

/**
 * Build a `Schema.String`-based field with min/max constraints and a
 * `VoilaField` annotation carrying the column + widget meta.
 */
export const string = (opts: StringFieldOpts = {}): Schema.Schema<string, string, never> => {
  let schema: Schema.Schema<string, string, never> = Schema.String;
  if (opts.min !== undefined) {
    schema = schema.pipe(Schema.minLength(opts.min));
  }
  if (opts.max !== undefined) {
    schema = schema.pipe(Schema.maxLength(opts.max));
  }
  const meta: StringFieldMeta = {
    kind: "string",
    widget: "string",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    default: opts.default,
    localized: opts.localized,
    unique: opts.unique,
    min: opts.min,
    max: opts.max,
  };
  return schema.pipe(Schema.annotations({ [VoilaField]: meta }));
};
