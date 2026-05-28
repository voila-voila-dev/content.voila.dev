// `number` field — annotated effect/Schema for a finite JSON number.

import { Schema } from "effect";
import type { NumberFieldMeta } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export interface NumberFieldOpts {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
  readonly unique?: boolean;
  readonly index?: boolean;
  readonly required?: boolean;
  readonly label?: string;
  readonly description?: string;
  readonly default?: number;
  readonly localized?: boolean;
}

export const number = (opts: NumberFieldOpts = {}): Schema.Schema<number, number, never> => {
  let schema: Schema.Schema<number, number, never> = Schema.Number;
  if (opts.integer) {
    schema = schema.pipe(Schema.int());
  }
  if (opts.min !== undefined) {
    schema = schema.pipe(Schema.greaterThanOrEqualTo(opts.min));
  }
  if (opts.max !== undefined) {
    schema = schema.pipe(Schema.lessThanOrEqualTo(opts.max));
  }
  const meta: NumberFieldMeta = {
    kind: "number",
    widget: "number",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    default: opts.default,
    localized: opts.localized,
    unique: opts.unique,
    index: opts.index,
    min: opts.min,
    max: opts.max,
    integer: opts.integer,
  };
  return schema.pipe(Schema.annotations({ [VoilaField]: meta }));
};
