// `datetime` field — instant in time, persisted as an ISO 8601 string.

import { Schema } from "effect";
import type { DateTimeFieldMeta } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export interface DateTimeFieldOpts {
  readonly required?: boolean;
  readonly default?: string;
  readonly label?: string;
  readonly description?: string;
  readonly localized?: boolean;
}

const isValidIsoDateTime = (s: string): boolean => {
  if (typeof s !== "string" || s.length === 0) return false;
  const time = Date.parse(s);
  if (Number.isNaN(time)) return false;
  // Require the string to round-trip through Date — rules out e.g. `"abc"` that
  // `Date.parse` may coerce in some engines.
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s);
};

export const datetime = (opts: DateTimeFieldOpts = {}): Schema.Schema<string, string, never> => {
  const schema = Schema.String.pipe(
    Schema.filter((s) => isValidIsoDateTime(s), {
      identifier: "VoilaDateTime",
      message: () => "Expected an ISO 8601 datetime string",
    }),
  );
  const meta: DateTimeFieldMeta = {
    kind: "datetime",
    widget: "datetime",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    default: opts.default,
    localized: opts.localized,
  };
  return schema.pipe(Schema.annotations({ [VoilaField]: meta }));
};
