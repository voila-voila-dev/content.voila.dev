import type { FieldDef } from "../types.ts";

export type DateField = FieldDef<string> & {
  kind: "date";
};

export type DateFieldOptions = Omit<DateField, "kind">;

export function date(options: DateFieldOptions = {}): DateField {
  return { ...options, kind: "date" };
}
