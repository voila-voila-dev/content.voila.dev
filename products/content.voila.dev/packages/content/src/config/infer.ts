// @voila/content/infer — resolve the TypeScript shape of a document from a
// config. Every downstream layer (typed client, forms, DB adapter) keys off
// these types instead of re-deriving the shape of a collection ad hoc.

import type { Schema } from "effect";
import type { Collection } from "./collection";
import type { NormalizedConfig } from "./config";
import type { FieldsMap } from "./fields/_map";
import type { Singleton } from "./singleton";

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
 * Resolve a field map to its decoded document shape: each field's annotated
 * effect/Schema collapses to its `Type` (the decoded value), expanded one
 * level for readable hovers. Localized fields are already narrowed to the
 * project's selected locales by `defineConfig`, so the brand and wide
 * `Record<Locale, T>` wrapper never leak through here.
 */
export type InferFields<Fields extends FieldsMap> = {
  readonly [K in keyof Fields]: Expand<Schema.Schema.Type<Fields[K]>>;
};

/**
 * The TypeScript shape of a document in the `Slug` collection of `C`.
 *
 * Walks `C["collections"][Slug].fields` and resolves each field via its
 * effect/Schema `Type`. Because `defineConfig` has already narrowed localized
 * fields to the selected locales, a `string({ localized: true })` field on a
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
