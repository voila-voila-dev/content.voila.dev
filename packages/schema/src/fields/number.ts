import type { FieldDef } from "../types.ts";

export type NumberField = FieldDef<number> & {
  kind: "number";
  min?: number;
  max?: number;
  integer?: boolean;
  step?: number;
};

export type NumberFieldOptions = Omit<NumberField, "kind">;

export function number(options: NumberFieldOptions = {}): NumberField {
  return { ...options, kind: "number" };
}
