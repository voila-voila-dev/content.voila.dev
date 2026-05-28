import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type ColorFormat = "hex" | "rgb" | "oklch";

export interface ColorOpts extends BaseFieldOpts<string> {
  readonly format?: ColorFormat;
}

const PATTERN: Record<ColorFormat, RegExp> = {
  hex: /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  rgb: /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i,
  oklch: /^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,
};

export const color = <const O extends ColorOpts = ColorOpts>(
  opts?: O,
): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  const fmt = o.format ?? "hex";
  return applyCommon(Schema.String.pipe(Schema.pattern(PATTERN[fmt])), o, {
    kind: "color",
    widget: "color",
    format: fmt,
  }) as WithLocalized<string, O>;
};
