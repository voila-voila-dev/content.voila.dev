import { fail, ok, type Validator, validator } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type DateTimeOpts = BaseFieldOpts<Date>;
export type DateTimeMeta = FieldMeta;

// A timestamp decoded to a `Date`. Its stored form is epoch milliseconds — the
// same representation the `datetime` column uses (SQLite INTEGER, Postgres
// TIMESTAMPTZ) and that the system createdAt/updatedAt columns use — so values
// round-trip against the database with no conversion shim.
function dateFromNumber(): Validator<Date> {
  return validator((v) => {
    if (v instanceof Date) return ok(v);
    if (typeof v === "number" && Number.isFinite(v)) return ok(new Date(v));
    return fail("Expected epoch milliseconds or a Date");
  });
}

export function datetime<const O extends DateTimeOpts = DateTimeOpts>(
  opts?: O,
): WithLocalized<Date, O, DateTimeMeta> {
  const meta: DateTimeMeta = { kind: "datetime", widget: "datetime" };
  return applyCommon(dateFromNumber(), opts, meta);
}
