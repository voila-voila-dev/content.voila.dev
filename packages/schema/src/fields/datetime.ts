import type { FieldDef } from "../types.ts";

export type DateTimeField = FieldDef<string> & {
  kind: "datetime";
};

export type DateTimeFieldOptions = Omit<DateTimeField, "kind">;

export function datetime(options: DateTimeFieldOptions = {}): DateTimeField {
  return { ...options, kind: "datetime" };
}
