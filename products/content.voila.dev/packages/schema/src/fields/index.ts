import { boolean } from "./boolean.ts";
import { date } from "./date.ts";
import { datetime } from "./datetime.ts";
import { json } from "./json.ts";
import { number } from "./number.ts";
import { select } from "./select.ts";
import { slug } from "./slug.ts";
import { string } from "./string.ts";

export type { BooleanField, BooleanFieldOptions } from "./boolean.ts";
export { boolean } from "./boolean.ts";
export type { DateField, DateFieldOptions } from "./date.ts";
export { date } from "./date.ts";
export type { DateTimeField, DateTimeFieldOptions } from "./datetime.ts";
export { datetime } from "./datetime.ts";
export type { JsonField, JsonFieldOptions } from "./json.ts";
export { json } from "./json.ts";
export type { NumberField, NumberFieldOptions } from "./number.ts";
export { number } from "./number.ts";
export type { SelectField, SelectFieldOptions, SelectOption } from "./select.ts";
export { select, selectOption, selectValues } from "./select.ts";
export type { SlugField, SlugFieldOptions } from "./slug.ts";
export { slug } from "./slug.ts";
export type { StringField, StringFieldOptions, StringFormat } from "./string.ts";
export { string } from "./string.ts";

export type FieldsRegistry = {
  string: typeof string;
  number: typeof number;
  boolean: typeof boolean;
  date: typeof date;
  datetime: typeof datetime;
  select: typeof select;
  slug: typeof slug;
  json: typeof json;
};

export const fields: FieldsRegistry = {
  string,
  number,
  boolean,
  date,
  datetime,
  select,
  slug,
  json,
};
