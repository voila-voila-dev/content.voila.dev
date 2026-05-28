// `boolean` field — annotated effect/Schema for a true/false value.

import { Schema } from "effect";
import type { BooleanFieldMeta } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export interface BooleanFieldOpts {
  readonly required?: boolean;
  readonly default?: boolean;
  readonly label?: string;
  readonly description?: string;
}

export const boolean = (opts: BooleanFieldOpts = {}): Schema.Schema<boolean, boolean, never> => {
  const meta: BooleanFieldMeta = {
    kind: "boolean",
    widget: "boolean",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    default: opts.default,
  };
  return Schema.Boolean.pipe(Schema.annotations({ [VoilaField]: meta }));
};
