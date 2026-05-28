import { Schema } from "effect";
import { applyCommon, type BaseFieldOpts, type WithLocalized } from "./_base";

export interface SlugOpts extends BaseFieldOpts<string> {
  /** Source field that auto-fills the slug in the admin. */
  readonly from?: string;
  /** Reserved slugs the admin should refuse. */
  readonly reserved?: ReadonlyArray<string>;
}

// Lowercase, hyphen-separated; no leading/trailing/consecutive hyphens.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slug = <const O extends SlugOpts = SlugOpts>(opts?: O): WithLocalized<string, O> => {
  const o = opts ?? ({} as O);
  return applyCommon(Schema.String.pipe(Schema.pattern(SLUG_PATTERN)), o, {
    kind: "slug",
    widget: "slug",
    unique: o.unique ?? true,
    from: o.from,
    reserved: o.reserved,
  }) as WithLocalized<string, O>;
};
