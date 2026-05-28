// @voila/content/define — defineCollection / defineSingleton / defineContent.
//
// Produces literal-typed Collection/Singleton descriptors. After the M1
// strip-down this file is the entire `@voila/content` surface — service
// Layers, the HTTP API, the typed client, and the queue subpath have all
// been removed pending a fresh rebuild.

import type { Schema } from "effect";

// -- Collections / Singletons ------------------------------------------------

/**
 * Field map — each value is an annotated effect/Schema.
 *
 * Uses `Schema.Schema.Any` (the canonical "any schema" type from effect) so
 * concrete field constructors assign cleanly without a variance dance.
 */
export type FieldsMap = Readonly<Record<string, Schema.Schema.Any>>;

export interface CollectionDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "collection";
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}

export interface SingletonDef<Slug extends string, Fields extends FieldsMap> {
  readonly kind: "singleton";
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}

export type Collection<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = CollectionDef<Slug, Fields>;

export type Singleton<
  Slug extends string = string,
  Fields extends FieldsMap = FieldsMap,
> = SingletonDef<Slug, Fields>;

export const defineCollection = <const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}): Collection<Slug, Fields> => ({
  kind: "collection",
  slug: def.slug,
  label: def.label,
  fields: def.fields,
});

export const defineSingleton = <const Slug extends string, const Fields extends FieldsMap>(def: {
  readonly slug: Slug;
  readonly label?: string;
  readonly fields: Fields;
}): Singleton<Slug, Fields> => ({
  kind: "singleton",
  slug: def.slug,
  label: def.label,
  fields: def.fields,
});

// -- defineContent -----------------------------------------------------------

export interface Branding {
  readonly name: string;
}

export interface ContentConfig {
  readonly branding: Branding;
  readonly collections?: ReadonlyArray<Collection>;
  readonly singletons?: ReadonlyArray<Singleton>;
}

/**
 * Pass-through builder. Returns the same shape it received — the engine
 * Layer composition that lived here previously was tied to packages that
 * no longer exist, so the function now exists only to brand the config and
 * give content.config.ts a stable default export.
 */
export const defineContent = (config: ContentConfig): ContentConfig => config;
