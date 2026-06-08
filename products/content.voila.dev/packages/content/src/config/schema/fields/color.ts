import { pattern as patternCheck, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export type ColorFormat = "hex" | "rgb" | "oklch";
export type ColorMeta = FieldMeta<{ readonly format?: ColorFormat }>;

export interface ColorOpts extends BaseFieldOpts<string> {
  readonly format?: ColorFormat;
}

const PATTERN: Record<ColorFormat, RegExp> = {
  hex: /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  rgb: /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i,
  oklch: /^oklch\(\s*[\d.]+%?\s+[\d.]+\s+[\d.]+(?:\s*\/\s*[\d.]+%?)?\s*\)$/i,
};

export function color<const O extends ColorOpts = ColorOpts>(
  opts?: O,
): WithLocalized<string, O, ColorMeta> {
  const fmt = opts?.format ?? "hex";
  const meta: ColorMeta = { kind: "color", widget: "color", format: fmt };
  return applyCommon(refine(str(), patternCheck(PATTERN[fmt])), opts, meta);
}
