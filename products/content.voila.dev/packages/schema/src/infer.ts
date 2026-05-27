import type { BooleanField } from "./fields/boolean.ts";
import type { DateField } from "./fields/date.ts";
import type { DateTimeField } from "./fields/datetime.ts";
import type { JsonField } from "./fields/json.ts";
import type { NumberField } from "./fields/number.ts";
import type { SelectField } from "./fields/select.ts";
import type { SlugField } from "./fields/slug.ts";
import type { StringField } from "./fields/string.ts";
import type { AnyFieldDef, FieldDef } from "./types.ts";

export type InferField<F extends AnyFieldDef> = F extends StringField
  ? string
  : F extends NumberField
    ? number
    : F extends BooleanField
      ? boolean
      : F extends DateField
        ? string
        : F extends DateTimeField
          ? string
          : F extends SelectField
            ? string
            : F extends SlugField
              ? string
              : F extends JsonField<infer T>
                ? T
                : F extends FieldDef<infer T>
                  ? T
                  : unknown;

type RequiredKeys<S extends Record<string, AnyFieldDef>> = {
  [K in keyof S]: S[K] extends { required: true } ? K : never;
}[keyof S];

type OptionalKeys<S extends Record<string, AnyFieldDef>> = Exclude<keyof S, RequiredKeys<S>>;

export type InferDoc<S extends Record<string, AnyFieldDef>> = {
  [K in RequiredKeys<S>]: InferField<S[K]>;
} & {
  [K in OptionalKeys<S>]?: InferField<S[K]>;
};
