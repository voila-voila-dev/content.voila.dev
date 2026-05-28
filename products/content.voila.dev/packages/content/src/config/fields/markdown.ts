import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type MarkdownFlavor = "commonmark" | "gfm" | "mdx";

export interface MarkdownOpts extends BaseFieldOpts<string> {
  readonly flavor?: MarkdownFlavor;
  readonly min?: number;
  readonly max?: number;
}

export const markdown = <const O extends MarkdownOpts = MarkdownOpts>(
  opts?: O,
): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  let s: Schema.Schema.Any = Schema.String;
  if (o.min !== undefined) s = s.pipe(Schema.minLength(o.min));
  if (o.max !== undefined) s = s.pipe(Schema.maxLength(o.max));
  return applyCommon(s, o, {
    kind: "markdown",
    widget: "markdown",
    flavor: o.flavor ?? "gfm",
  }) as WithLocalized<string, O>;
};
