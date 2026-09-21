// @voila/content/collection — defineCollection.

import type { GroupDef } from "./_groups";
import type { FieldsMap } from "./fields";

/**
 * Opt a collection into full-text search. `true` auto-indexes the collection's
 * text-bearing fields (string/slug/markdown/code/enum/select/multiSelect/richText);
 * an array names the exact fields to index (any kind — values are stringified).
 * Like `revisions`, it's runtime-only: it adds no columns to the collection's own
 * table (the index lives in the engine-owned `voila_search` store).
 */
export type SearchOption = boolean | ReadonlyArray<string>;

export interface CollectionDef<
  Slug extends string,
  Fields extends FieldsMap,
  Drafts extends boolean = boolean,
> {
  readonly kind: "collection";
  readonly slug: Slug;
  readonly label?: string;
  /**
   * Singular form of `label` for one document ("New post", "Edit post"). Defaults
   * to a naive singularization of `label` (a trailing "s" is dropped).
   */
  readonly labelSingular?: string;
  /**
   * Phosphor icon name (e.g. `"Article"`) shown beside the collection in the
   * admin sidebar and command palette. An unknown name falls back to the kind's
   * default icon.
   */
  readonly icon?: string;
  /**
   * Sidebar group label the collection is listed under. Collections that share
   * a `group` render together, in first-seen declaration order; omit for the
   * default "Collections" group.
   */
  readonly group?: string;
  /**
   * Field whose value names a document (e.g. `"title"`). The admin UI uses it
   * wherever one row needs a human heading — the detail page, breadcrumbs —
   * falling back to the collection label when unset or empty.
   *
   * Held as plain `string` here (`keyof Fields` would make `Fields` invariant
   * and break `Collection<…> extends Collection`); `defineCollection` checks
   * the key against the declared fields at the authoring site.
   */
  readonly titleField?: string;
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
  /**
   * Opt into full-text search (see {@link SearchOption}). Off by default. Like
   * `revisions`, runtime-only — the index lives in the engine-owned
   * `voila_search` store, so row shapes are unchanged and it isn't type-level.
   */
  readonly search?: SearchOption;
  /**
   * Optional field groups for the admin detail/edit page (a left sub-nav, one
   * polished card per group). Order is array order. Held with the wide
   * `GroupDef` (string keys) for the same reason as `titleField`;
   * `defineCollection` checks each group's field keys against the declared
   * fields at the authoring site. Omit for the flat (ungrouped) layout.
   */
  readonly groups?: ReadonlyArray<GroupDef>;
  /**
   * Where the rows live. Default: a table in the content database, generated
   * by the migrations. `external: true` declares a collection with no table of
   * its own — the admin runtime serves it from a `CollectionSource` registered
   * under the slug (`createAdminRuntime(config, { sources })`). Everything
   * else (list views, filters, sorting, counts, the record form) is unchanged.
   */
  readonly external?: boolean;
  /**
   * Which write operations the collection offers. All default to `true`.
   * `false` hides the matching admin UI (New / Duplicate for `create`,
   * Delete for `delete`, Edit for `update`) and the REST route answers
   * `405 NOT_SUPPORTED`. Typical for a read-mostly external collection.
   */
  readonly operations?: CollectionOperations;
  readonly fields: Fields;
}

/** Per-operation switches; see `CollectionDef.operations`. */
export interface CollectionOperations {
  readonly create?: boolean;
  readonly update?: boolean;
  readonly delete?: boolean;
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
  readonly labelSingular?: string;
  readonly icon?: string;
  readonly group?: string;
  readonly titleField?: keyof Fields & string;
  readonly drafts?: Drafts;
  readonly revisions?: boolean;
  readonly search?: SearchOption;
  readonly groups?: ReadonlyArray<GroupDef<keyof Fields & string>>;
  readonly external?: boolean;
  readonly operations?: CollectionOperations;
  readonly fields: Fields;
}): Collection<Slug, Fields, Drafts> {
  return {
    kind: "collection",
    slug: def.slug,
    label: def.label,
    labelSingular: def.labelSingular,
    icon: def.icon,
    group: def.group,
    titleField: def.titleField,
    drafts: def.drafts,
    revisions: def.revisions,
    search: def.search,
    groups: def.groups,
    external: def.external,
    operations: def.operations,
    fields: def.fields,
  };
}
