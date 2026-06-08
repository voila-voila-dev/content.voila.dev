import { type Check, maxLength, minLength, pattern as patternCheck, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type StringFormat = "email" | "url" | "uuid";

export type StringMeta = FieldMeta<{
  readonly format?: StringFormat;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: string;
}>;

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

export function string<const O extends StringOpts = StringOpts>(
  opts?: O,
): WithLocalized<string, O, StringMeta> {
  const checks: Check<string>[] = [];
  if (opts?.min !== undefined) checks.push(minLength(opts.min));
  if (opts?.max !== undefined) checks.push(maxLength(opts.max));
  if (opts?.pattern) checks.push(patternCheck(opts.pattern));
  if (opts?.format) checks.push(patternCheck(FORMAT_PATTERN[opts.format]));
  const meta: StringMeta = {
    kind: "string",
    widget: "string",
    format: opts?.format,
    min: opts?.min,
    max: opts?.max,
    pattern: opts?.pattern?.source,
  };
  return applyCommon(checks.length ? refine(str(), ...checks) : str(), opts, meta);
}
