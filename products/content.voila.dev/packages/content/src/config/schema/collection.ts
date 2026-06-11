// @voila/content/collection — defineCollection.

import type { FieldsMap } from "./fields";

export interface CollectionDef<
  Slug extends string,
  Fields extends FieldsMap,
  Drafts extends boolean = boolean,
> {
  readonly kind: "collection";
  readonly slug: Slug;
  readonly label?: string;
  /**
   * Opt into draft/published workflow. Adds `status` (`draft`/`published`) and a
   * nullable `publishedAt` (for scheduled publishing) to the table; `list`
   * returns only live published rows unless asked otherwise. Off by default —
   * a collection's rows are public the moment they're created.
   *
   * The flag is carried at the type level (`Drafts`), so downstream surfaces —
   * the typed client's `Stored` rows — know whether `status`/`publishedAt`
   * exist without any cast.
   */
  readonly drafts?: Drafts;
  /**
   * Opt into version history. Every content write (create, update, publish,
   * unpublish) snapshots the stored row into the engine-owned `voila_revisions`
   * table; past revisions can be listed and restored. Off by default. Unlike
   * `drafts`, the flag adds no columns to the collection's own table — row
   * shapes are unchanged — so it isn't carried at the type level.
   */
  readonly revisions?: boolean;
  readonly fields: Fields;
}

export type Collection<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
  Drafts extends boolean = boolean,
> = CollectionDef<Slug, Fields, Drafts>;

export function defineCollection<
  const Slug extends string,
  const Fields extends FieldsMap,
  const Drafts extends boolean = false,
>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly drafts?: Drafts;
  readonly revisions?: boolean;
  readonly fields: Fields;
}): Collection<Slug, Fields, Drafts> {
  return {
    kind: "collection",
    slug: def.slug,
    label: def.label,
    drafts: def.drafts,
    revisions: def.revisions,
    fields: def.fields,
  };
}
