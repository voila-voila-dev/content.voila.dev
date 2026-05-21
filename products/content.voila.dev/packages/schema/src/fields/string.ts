import type { FieldDef } from "../types.ts";

export type StringFormat = "email" | "url" | "uuid";

export type StringField = FieldDef<string> & {
  kind: "string";
  min?: number;
  max?: number;
  pattern?: RegExp;
  format?: StringFormat;
};

export type StringFieldOptions = Omit<StringField, "kind">;

export function string(options: StringFieldOptions = {}): StringField {
  return { ...options, kind: "string" };
}
