import type { FieldDef } from "../types.ts";

export type BooleanField = FieldDef<boolean> & {
  kind: "boolean";
};

export type BooleanFieldOptions = Omit<BooleanField, "kind">;

export function boolean(options: BooleanFieldOptions = {}): BooleanField {
  return { ...options, kind: "boolean" };
}
