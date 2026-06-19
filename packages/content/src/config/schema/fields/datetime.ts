import { fail, ok, type Validator, validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DateTimeOpts = BaseFieldOpts<Date>;
export type DateTimeMeta = FieldMeta;

// A timestamp decoded to a `Date`. Its stored form is epoch milliseconds — the
// same representation the `datetime` column uses (SQLite INTEGER, Postgres
// TIMESTAMPTZ) and that the system createdAt/updatedAt columns use — so values
// round-trip against the database with no conversion shim. ISO-8601 strings are
// also accepted: `JSON.stringify` renders a `Date` as one, so that's what the
// typed client puts on the wire when a form emits a `Date`.
function dateFromEncoded(): Validator<Date> {
  return validator((v) => {
    if (v instanceof Date) return ok(v);
    if (typeof v === "number" && Number.isFinite(v)) return ok(new Date(v));
    if (typeof v === "string") {
      const ms = Date.parse(v);
      if (Number.isFinite(ms)) return ok(new Date(ms));
    }
    return fail("Expected epoch milliseconds, an ISO-8601 string, or a Date");
  });
}

export function datetime<const O extends DateTimeOpts = DateTimeOpts>(
  opts?: O,
): WithLocalized<Date, O, DateTimeMeta> {
  const meta: DateTimeMeta = { kind: "datetime", widget: "datetime" };
  return applyCommon(dateFromEncoded(), opts, meta);
}
