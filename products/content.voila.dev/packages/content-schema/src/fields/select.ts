// `select` field — one-of constrained string with widget hints.
//
// Returns `Schema.Schema<TLiteral, string, never>` where `TLiteral` is the
// union of the `value` strings, so consumers get `Schema<"draft" | "published">`
// rather than a generic `Schema<string>`.

import { Schema } from "effect";
import type { SelectFieldMeta, SelectOption } from "../annotation.ts";
import { VoilaField } from "../annotation.ts";

export type SelectOptionInput = string | { readonly value: string; readonly label: string };

/**
 * Project an option input to its literal `value` string. Used to narrow the
 * field's decoded type to `"draft" | "published" | …` rather than `string`.
 */
export type SelectValue<Opt> = Opt extends string
  ? Opt
  : Opt extends { readonly value: infer V extends string }
    ? V
    : never;

export interface SelectFieldOpts<Opts extends readonly SelectOptionInput[]> {
  readonly options: Opts;
  readonly required?: boolean;
  readonly label?: string;
  readonly description?: string;
  readonly default?: SelectValue<Opts[number]>;
}

const normalize = (opt: SelectOptionInput): SelectOption =>
  typeof opt === "string" ? { value: opt, label: opt } : { value: opt.value, label: opt.label };

export const select = <const Opts extends readonly SelectOptionInput[]>(
  opts: SelectFieldOpts<Opts>,
): Schema.Schema<SelectValue<Opts[number]>, string, never> => {
  const normalized = opts.options.map(normalize);
  if (normalized.length === 0) {
    throw new Error("select() requires at least one option");
  }
  // Build a filter over Schema.String. We could use Schema.Literal to get the
  // literal type for free, but the runtime values are only known via the
  // const generic; filtering keeps the encoded form a plain `string` (matching
  // the rest of the field surface) while the decoded type narrows via the
  // explicit return-type annotation below.
  const allowed = new Set(normalized.map((o) => o.value));
  const schema = Schema.String.pipe(
    Schema.filter((s): s is SelectValue<Opts[number]> => allowed.has(s), {
      identifier: "VoilaSelect",
      message: () => `Expected one of: ${normalized.map((o) => o.value).join(", ")}`,
    }),
  );
  const meta: SelectFieldMeta = {
    kind: "select",
    widget: "select",
    required: opts.required,
    label: opts.label,
    description: opts.description,
    default: opts.default,
    options: normalized,
  };
  return schema.pipe(Schema.annotations({ [VoilaField]: meta })) as Schema.Schema<
    SelectValue<Opts[number]>,
    string,
    never
  >;
};
