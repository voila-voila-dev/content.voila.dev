import { type Check, maxLength, minLength, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type MarkdownFlavor = "commonmark" | "gfm" | "mdx";
export type MarkdownMeta = FieldMeta<{ readonly flavor?: MarkdownFlavor }>;

export interface MarkdownOpts extends BaseFieldOpts<string> {
  readonly flavor?: MarkdownFlavor;
  readonly min?: number;
  readonly max?: number;
}

export function markdown<const O extends MarkdownOpts = MarkdownOpts>(
  opts?: O,
): WithLocalized<string, O, MarkdownMeta> {
  const checks: Check<string>[] = [];
  if (opts?.min !== undefined) checks.push(minLength(opts.min));
  if (opts?.max !== undefined) checks.push(maxLength(opts.max));
  const meta: MarkdownMeta = {
    kind: "markdown",
    widget: "markdown",
    flavor: opts?.flavor ?? "gfm",
  };
  return applyCommon(checks.length ? refine(str(), ...checks) : str(), opts, meta);
}
