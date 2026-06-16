// @voila/content/infer — resolve the TypeScript shape of a document from a
// config. Every downstream layer (typed client, forms, DB adapter) keys off
// these types instead of re-deriving the shape of a collection ad hoc.

import type { NormalizedConfig } from "../config";
import type { Collection } from "./collection";
import type { Field } from "./fields/_base";
import type { LocalizedMarker } from "./fields/_localized";
import type { FieldsMap } from "./fields/_map";
import type { Singleton } from "./singleton";

/** The validated (output) type a field carries, regardless of its meta type. */
// biome-ignore lint/suspicious/noExplicitAny: match any meta type when extracting T.
type FieldType<F> = F extends Field<infer T, any> ? T : never;

/**
 * Expand a field value one level so editors render the object's members
 * inline (e.g. a `media` field shows `{ id; url; mime; ... }` instead of the
 * opaque `MediaValue` alias) rather than collapsing it to its named type.
 *
 * Deliberately shallow: it does NOT recurse into nested object members. The
 * object branch leaves `T[K]` untouched, so recursive field types like
 * `RichTextValue` (an array of self-referential elements) can't trigger
 * "type instantiation is excessively deep". Arrays expand their element one
 * level; `Date`, functions, and primitives pass through unchanged.
 */
type Expand<T> = T extends Date
  ? T
  : T extends (...args: never[]) => unknown
    ? T
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<Expand<U>>
      : T extends object
        ? { [K in keyof T]: T[K] }
        : T;

/**
 * Resolve a field map to its document shape: each field collapses to the value
 * type `T` it carries (`Field<T>`), expanded one level for readable hovers.
 * Localized fields are already narrowed to the project's selected locales by
 * `defineConfig` (the locale brand rides along on the field, not its value
 * type), so a localized field surfaces as its per-locale record here.
 */
export type InferFields<Fields extends FieldsMap> = {
  readonly [K in keyof Fields]: Expand<FieldType<Fields[K]>>;
};

/**
 * Like {@link InferFields}, but localized fields flatten to their single-locale
 * value (possibly `undefined` — a locale may have no value even after the
 * fallback chain). The shape of a `?locale=` read.
 */
export type InferLocalizedFields<Fields extends FieldsMap> = {
  readonly [K in keyof Fields]: Fields[K] extends LocalizedMarker<infer T>
    ? Expand<T> | undefined
    : Expand<FieldType<Fields[K]>>;
};

/**
 * The TypeScript shape of a `Slug` document fetched with a `locale` — every
 * localized field resolved to one locale's value. Companion to {@link InferDoc}.
 */
export type InferLocalizedDoc<
  C extends NormalizedConfig,
  Slug extends keyof C["collections"] & string,
> =
  C["collections"][Slug] extends Collection<string, infer Fields>
    ? InferLocalizedFields<Fields>
    : never;

/**
 * The TypeScript shape of a document in the `Slug` collection of `C`.
 *
 * Walks `C["collections"][Slug].fields` and resolves each field to its value
 * type. Because `defineConfig` has already narrowed localized fields to the
 * selected locales, a `string({ localized: true })` field on a
 * config with `locales: ["en-US", "fr-FR"]` surfaces as
 * `{ readonly "en-US": string; readonly "fr-FR": string }`.
 *
 * @example
 * const config = defineConfig({ ...,  collections: { posts } });
 * type Post = InferDoc<typeof config, "posts">;
 */
export type InferDoc<C extends NormalizedConfig, Slug extends keyof C["collections"] & string> =
  C["collections"][Slug] extends Collection<string, infer Fields> ? InferFields<Fields> : never;

/**
 * Whether the `Slug` collection of `C` opted into the drafts workflow
 * (`defineCollection({ drafts: true })`). Resolves to the literal `true`/`false`
 * carried by the collection's `Drafts` type parameter; a hand-built collection
 * whose flag is only known as `boolean` resolves to `false`, matching the
 * runtime default (no draft columns unless explicitly enabled).
 */
export type InferDrafts<C extends NormalizedConfig, Slug extends keyof C["collections"] & string> =
  C["collections"][Slug] extends Collection<string, FieldsMap, infer Drafts>
    ? boolean extends Drafts
      ? false
      : Drafts
    : false;

/**
 * The TypeScript shape of a singleton document in `C`. Companion to
 * {@link InferDoc} for `defineSingleton` slugs.
 *
 * @example
 * type Settings = InferSingleton<typeof config, "settings">;
 */
export type InferSingleton<
  C extends NormalizedConfig,
  Slug extends keyof C["singletons"] & string,
> = C["singletons"][Slug] extends Singleton<string, infer Fields> ? InferFields<Fields> : never;

/**
 * The TypeScript shape of a singleton document fetched with a `locale` — every
 * localized field resolved to one locale's value. Companion to
 * {@link InferLocalizedDoc} for `defineSingleton` slugs.
 */
export type InferLocalizedSingleton<
  C extends NormalizedConfig,
  Slug extends keyof C["singletons"] & string,
> =
  C["singletons"][Slug] extends Singleton<string, infer Fields>
    ? InferLocalizedFields<Fields>
    : never;
