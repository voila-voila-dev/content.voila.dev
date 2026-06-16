import { pattern as patternCheck, refine, str } from "../std";
import type { FieldMeta } from "./_annotation";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface SlugOpts extends BaseFieldOpts<string> {
  /** Source field that auto-fills the slug in the admin. */
  readonly from?: string;
  /** Reserved slugs the admin should refuse. */
  readonly reserved?: ReadonlyArray<string>;
}

export type SlugMeta = FieldMeta<{
  readonly from?: string;
  readonly reserved?: ReadonlyArray<string>;
}>;

// Lowercase, hyphen-separated; no leading/trailing/consecutive hyphens.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Canonical slug derivation, shared by the admin form (derive-on-type from the
 * `from` field) and the REST create path (derive when absent). Strips
 * diacritics, lowercases, and collapses every non-alphanumeric run to a single
 * hyphen — the output always satisfies the slug field's own pattern (or is
 * `""` when the source has no usable characters).
 */
export function slugify(source: string): string {
  return source
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slug<const O extends SlugOpts = SlugOpts>(
  opts?: O,
): WithLocalized<string, O, SlugMeta> {
  const meta: SlugMeta = {
    kind: "slug",
    widget: "slug",
    unique: opts?.unique ?? true,
    from: opts?.from,
    reserved: opts?.reserved,
  };
  return applyCommon(refine(str(), patternCheck(SLUG_PATTERN)), opts, meta);
}
