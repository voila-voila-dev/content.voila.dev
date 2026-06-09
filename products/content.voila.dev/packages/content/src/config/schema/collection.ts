// @voila/content/collection — defineCollection.

import type { FieldsMap } from "./fields";

export interface CollectionDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "collection";
  readonly slug: Slug;
  readonly label?: string;
  /**
   * Opt into draft/published workflow. Adds `status` (`draft`/`published`) and a
   * nullable `publishedAt` (for scheduled publishing) to the table; `list`
   * returns only live published rows unless asked otherwise. Off by default —
   * a collection's rows are public the moment they're created.
   */
  readonly drafts?: boolean;
  readonly fields: Fields;
}

export type Collection<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = CollectionDef<Slug, Fields>;

export function defineCollection<const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly drafts?: boolean;
  readonly fields: Fields;
}): Collection<Slug, Fields> {
  return {
    kind: "collection",
    slug: def.slug,
    label: def.label,
    drafts: def.drafts,
    fields: def.fields,
  };
}
