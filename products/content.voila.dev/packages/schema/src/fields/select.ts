import type { FieldDef } from "../types.ts";

/**
 * A single choice for a `select` field. The shorthand `string` form is sugar
 * for `{ label: value, value }` — handy when the stored value reads fine as a
 * label (`"draft"`, `"published"`). Use the object form when the two differ.
 */
export type SelectOption = string | { label: string; value: string };

export type SelectField = FieldDef<string> & {
  kind: "select";
  options: readonly SelectOption[];
};

export type SelectFieldOptions = Omit<SelectField, "kind">;

/**
 * `select` stores a single string drawn from a fixed `options` list. The
 * options are static (declared in the schema); dynamic, query-backed choices
 * are the job of the `relation` field (M4), not this one.
 */
export function select(options: SelectFieldOptions): SelectField {
  return { ...options, kind: "select" };
}

/** Normalize an option to its `{ label, value }` form. */
export function selectOption(option: SelectOption): { label: string; value: string } {
  return typeof option === "string" ? { label: option, value: option } : option;
}

/** The set of allowed stored values for a select field, in declaration order. */
export function selectValues(field: SelectField): string[] {
  return field.options.map((o) => selectOption(o).value);
}
