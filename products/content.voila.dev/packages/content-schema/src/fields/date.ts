// `date` field — calendar date (no time), persisted as an ISO `YYYY-MM-DD` string.

import { Schema } from "effect";
import type { DateFieldMeta } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export interface DateFieldOpts {
  readonly required?: boolean;
  readonly default?: string;
  readonly label?: string;
  readonly description?: string;
  readonly localized?: boolean;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidCalendarDate = (s: string): boolean => {
  if (!ISO_DATE_PATTERN.test(s)) return false;
  const parts = s.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

export const date = (opts: DateFieldOpts = {}): Schema.Schema<string, string, never> => {
  const schema = Schema.String.pipe(
    Schema.filter((s) => isValidCalendarDate(s), {
      identifier: "VoilaDate",
      message: () => "Expected an ISO calendar date (YYYY-MM-DD)",
    }),
  );
  const meta: DateFieldMeta = {
    kind: "date",
    widget: "date",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    default: opts.default,
    localized: opts.localized,
  };
  return schema.pipe(Schema.annotations({ [VoilaField]: meta }));
};
