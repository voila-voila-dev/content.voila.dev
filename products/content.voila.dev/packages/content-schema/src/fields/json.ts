// `json` field — arbitrary JSON-serialisable value.

import { Schema } from "effect";
import type { JsonFieldMeta } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export interface JsonFieldOpts {
  readonly required?: boolean;
  readonly default?: unknown;
  readonly label?: string;
  readonly description?: string;
  readonly localized?: boolean;
}

// We use `Schema.Unknown` because the column is opaque at the schema layer —
// the SQL generator stores it as TEXT/JSONB and the UI renders it via a JSON
// editor widget. Domain-level validation is the consumer's job.
export const json = (opts: JsonFieldOpts = {}): Schema.Schema<unknown, unknown, never> => {
  const meta: JsonFieldMeta = {
    kind: "json",
    widget: "json",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    default: opts.default,
    localized: opts.localized,
  };
  return Schema.Unknown.pipe(Schema.annotations({ [VoilaField]: meta }));
};
