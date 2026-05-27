import type { FieldDef } from "../types.ts";

export type StringFormat = "email" | "url" | "uuid";

export type StringField = FieldDef<string> & {
  kind: "string";
  min?: number;
  max?: number;
  pattern?: RegExp;
  format?: StringFormat;
  /** Render as a multi-line textarea instead of a single-line input. */
  multiline?: boolean;
  /** Initial visible rows when `multiline` is set. Defaults to 4. */
  rows?: number;
};

export type StringFieldOptions = Omit<StringField, "kind">;

export function string(options: StringFieldOptions = {}): StringField {
  return { ...options, kind: "string" };
}
