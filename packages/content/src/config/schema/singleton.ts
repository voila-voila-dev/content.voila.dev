// @voila/content/singleton — defineSingleton.

import type { GroupDef } from "./_groups";
import type { FieldsMap } from "./fields";

export interface SingletonDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "singleton";
  readonly slug: Slug;
  readonly label?: string;
  /**
   * Optional field groups for the admin edit page (see `CollectionDef.groups`).
   * Held with the wide `GroupDef`; `defineSingleton` checks the field keys at
   * the authoring site.
   */
  readonly groups?: ReadonlyArray<GroupDef>;
  readonly fields: Fields;
}

export type Singleton<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = SingletonDef<Slug, Fields>;

export function defineSingleton<const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly groups?: ReadonlyArray<GroupDef<keyof Fields & string>>;
  readonly fields: Fields;
}): Singleton<Slug, Fields> {
  return {
    kind: "singleton",
    slug: def.slug,
    label: def.label,
    groups: def.groups,
    fields: def.fields,
  };
}
