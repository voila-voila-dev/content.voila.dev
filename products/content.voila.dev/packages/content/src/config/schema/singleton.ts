// @voila/content/singleton — defineSingleton.

import type { FieldsMap } from "./fields";

export interface SingletonDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "singleton";
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}

export type Singleton<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = SingletonDef<Slug, Fields>;

export function defineSingleton<const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}): Singleton<Slug, Fields> {
  return {
    kind: "singleton",
    slug: def.slug,
    label: def.label,
    fields: def.fields,
  };
}
