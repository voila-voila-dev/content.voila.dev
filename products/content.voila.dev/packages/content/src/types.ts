import type { AnyFieldDef } from "@voila/content-schema";
import type { ComponentType } from "react";

/** Icon component accepted by collection/singleton defs (e.g. a `@voila/ui/icons` export). */
export type IconComponent = ComponentType<{ className?: string }>;

export type Branding = {
  /** Display name shown in the sidebar header, browser tab, and emails. */
  name?: string;
  /** Light-mode logo URL. */
  logo?: string;
  /** Dark-mode logo URL. */
  logoDark?: string;
  /** Favicon URL. */
  favicon?: string;
  /** CSS color string used as `--voila-color-accent`. */
  accent?: string;
};

export type Mount = {
  /** Where the admin SPA is mounted. Default: `/admin`. */
  admin?: string;
  /** Where the REST/RPC API is mounted. Default: `/admin/api`. */
  api?: string;
  /** Where the MCP server is mounted. Default: `/admin/mcp`. */
  mcp?: string;
};

export type ResolvedMount = Required<Mount>;

export type FieldsRecord = Record<string, AnyFieldDef>;

/**
 * Per-collection list-view configuration. `columns` is the ordered list of
 * field keys (or system keys: `id`, `createdAt`, `updatedAt`) that the admin
 * table should render. Omit to fall back to every declared field plus
 * `updatedAt`.
 */
export type ListConfig<Fields extends FieldsRecord = FieldsRecord> = {
  columns?: ReadonlyArray<(keyof Fields & string) | "id" | "createdAt" | "updatedAt">;
};

export type CollectionDef<
  Slug extends string = string,
  Fields extends FieldsRecord = FieldsRecord,
> = {
  slug: Slug;
  label?: string;
  icon?: IconComponent;
  description?: string;
  fields: Fields;
  list?: ListConfig<Fields>;
};

export type SingletonDef<
  Slug extends string = string,
  Fields extends FieldsRecord = FieldsRecord,
> = {
  slug: Slug;
  label?: string;
  icon?: IconComponent;
  description?: string;
  fields: Fields;
};

export type Collection<
  Slug extends string = string,
  Fields extends FieldsRecord = FieldsRecord,
> = CollectionDef<Slug, Fields> & {
  readonly kind: "collection";
};

export type Singleton<
  Slug extends string = string,
  Fields extends FieldsRecord = FieldsRecord,
> = SingletonDef<Slug, Fields> & {
  readonly kind: "singleton";
};

// biome-ignore lint/suspicious/noExplicitAny: variance escape hatch — registries operate on any field shape.
export type AnyCollection = Collection<string, any>;
// biome-ignore lint/suspicious/noExplicitAny: variance escape hatch — registries operate on any field shape.
export type AnySingleton = Singleton<string, any>;

/** Map from slug → entry. Replaces the earlier array storage. */
export type CollectionMap = Readonly<Record<string, AnyCollection>>;
export type SingletonMap = Readonly<Record<string, AnySingleton>>;

/**
 * Type-level converter from a tuple of items with a literal `slug` to a
 * record keyed by that slug. `defineContent` uses this to preserve per-slug
 * types when the consumer passes their collections/singletons as an array.
 */
export type SlugMap<T extends { slug: string }> = {
  readonly [Item in T as Item["slug"]]: Item;
};

export type ContentConfig<
  Collections extends readonly AnyCollection[] = readonly AnyCollection[],
  Singletons extends readonly AnySingleton[] = readonly AnySingleton[],
> = {
  branding?: Branding;
  mount?: Mount;
  collections?: Collections;
  singletons?: Singletons;
};

export type Content<
  Collections extends CollectionMap = CollectionMap,
  Singletons extends SingletonMap = SingletonMap,
> = {
  branding: Branding;
  mount: ResolvedMount;
  /** Collections indexed by slug. Iterate via `Object.values(content.collections)`. */
  collections: Collections;
  /** Singletons indexed by slug. Iterate via `Object.values(content.singletons)`. */
  singletons: Singletons;
};

/** Erased shape for code that needs to accept any Content. */
export type AnyContent = Content<CollectionMap, SingletonMap>;

/** Alias retained for internal symmetry with the pre-resolution input shape. */
export type ResolvedContentConfig = AnyContent;
