// @voila/content/collection — defineCollection.

import type { FieldsMap } from "./fields";

export interface CollectionDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "collection";
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}

export type Collection<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = CollectionDef<Slug, Fields>;

export function defineCollection<const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}): Collection<Slug, Fields> {
  return {
    kind: "collection",
    slug: def.slug,
    label: def.label,
    fields: def.fields,
  };
}
