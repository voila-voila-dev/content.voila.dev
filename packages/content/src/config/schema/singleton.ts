// @voila/content/singleton — defineSingleton.

import type { GroupDef } from "./_groups";
import type { FieldsMap } from "./fields";

export interface SingletonDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "singleton";
  readonly slug: Slug;
  readonly label?: string;
  /** Phosphor icon name shown beside the singleton in the admin sidebar. */
  readonly icon?: string;
  /** Sidebar group label; omit for the default "Content" group. */
  readonly group?: string;
  /** Position in the admin sidebar, ascending (see `CollectionDef.order`). */
  readonly order?: number;
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
  readonly icon?: string;
  readonly group?: string;
  readonly order?: number;
  readonly groups?: ReadonlyArray<GroupDef<keyof Fields & string>>;
  readonly fields: Fields;
}): Singleton<Slug, Fields> {
  return {
    kind: "singleton",
    slug: def.slug,
    label: def.label,
    icon: def.icon,
    group: def.group,
    order: def.order,
    groups: def.groups,
    fields: def.fields,
  };
}
