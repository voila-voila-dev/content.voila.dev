import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type StringFormat = "email" | "url" | "uuid";

export interface StringOpts extends BaseFieldOpts<string> {
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: RegExp;
  readonly format?: StringFormat;
}

const FORMAT_PATTERN: Record<StringFormat, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  url: /^https?:\/\/\S+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};

export const string = <const O extends StringOpts = StringOpts>(
  opts?: O,
): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  let s: Schema.Schema.Any = Schema.String;
  if (o.min !== undefined) s = s.pipe(Schema.minLength(o.min));
  if (o.max !== undefined) s = s.pipe(Schema.maxLength(o.max));
  if (o.pattern) s = s.pipe(Schema.pattern(o.pattern));
  if (o.format) s = s.pipe(Schema.pattern(FORMAT_PATTERN[o.format]));
  return applyCommon(s, o, {
    kind: "string",
    widget: "string",
    format: o.format,
    min: o.min,
    max: o.max,
    pattern: o.pattern?.source,
  }) as WithLocalized<string, O>;
};
