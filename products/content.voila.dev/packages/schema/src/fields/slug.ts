import type { FieldDef } from "../types.ts";

export type SlugField = FieldDef<string> & {
  kind: "slug";
  /**
   * Sibling field name to auto-derive the slug from (e.g. `"title"`). The
   * widget slugifies that field's value until the user edits the slug by
   * hand, after which it stops tracking. Omit for a purely manual slug.
   */
  from?: string;
  /** Word separator used when deriving + validating. Defaults to `"-"`. */
  separator?: string;
};

export type SlugFieldOptions = Omit<SlugField, "kind">;

/**
 * `slug` is a URL-safe string. It usually wants `unique: true`; that's left to
 * the caller rather than forced, since nested/scoped slugs are a valid shape.
 */
export function slug(options: SlugFieldOptions = {}): SlugField {
  return { ...options, kind: "slug" };
}
