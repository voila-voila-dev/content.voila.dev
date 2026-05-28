import { Schema } from "effect";
import type { Branding } from "./branding";
import type { Collection } from "./collection";
import type { FieldMeta } from "./fields/_annotation";
import { VoilaField, VoilaInner } from "./fields/_annotation";
import type { Locale } from "./fields/_locale";
import type { NarrowFields } from "./fields/_localized";
import type { FieldsMap } from "./fields/_map";
import type { I18nConfig } from "./i18n";
import type { Singleton } from "./singleton";

export type CollectionMap = Readonly<Record<string, Collection>>;
export type SingletonMap = Readonly<Record<string, Singleton>>;

export interface Config<
  Locales extends ReadonlyArray<Locale> = ReadonlyArray<Locale>,
  Collections extends CollectionMap = CollectionMap,
  Singletons extends SingletonMap = SingletonMap,
> {
  readonly branding: Branding;
  readonly i18n?: I18nConfig<Locales>;
  /**
   * Map of collections keyed by slug. Access with `config.collections.posts`
   * instead of walking an array.
   */
  readonly collections?: Collections;
  /** Map of singletons keyed by slug. */
  readonly singletons?: Singletons;
}

// Narrow every collection's/singleton's localized fields to the selected
// locales subset. Non-localized fields and collection identity pass through.
type NarrowCollection<C, L extends Locale> =
  C extends Collection<infer S, infer F> ? Collection<S, NarrowFields<F, L>> : C;
type NarrowSingleton<Sg, L extends Locale> =
  Sg extends Singleton<infer S, infer F> ? Singleton<S, NarrowFields<F, L>> : Sg;
type NarrowCollections<CM extends CollectionMap, L extends Locale> = {
  readonly [K in keyof CM]: NarrowCollection<CM[K], L>;
};
type NarrowSingletons<SM extends SingletonMap, L extends Locale> = {
  readonly [K in keyof SM]: NarrowSingleton<SM[K], L>;
};

/**
 * The shape `defineConfig` actually returns. `collections` and `singletons`
 * are filled with `{}` when omitted, so `config.collections.posts` is a static
 * typed access — no `?.` or non-null assertions required at the call site.
 * Localized fields are also narrowed: `Schema<Record<Locale, T>>` becomes
 * `Schema<Record<Locales[number], T>>`.
 */
export interface NormalizedConfig<
  Locales extends ReadonlyArray<Locale> = ReadonlyArray<Locale>,
  Collections extends CollectionMap = CollectionMap,
  Singletons extends SingletonMap = SingletonMap,
> {
  readonly branding: Branding;
  readonly i18n?: I18nConfig<Locales>;
  readonly collections: NarrowCollections<Collections, Locales[number]>;
  readonly singletons: NarrowSingletons<Singletons, Locales[number]>;
}

const narrowFieldsRuntime = (fields: FieldsMap, locales: ReadonlyArray<Locale>): FieldsMap => {
  if (locales.length === 0) return fields;
  const [head, ...rest] = locales;
  // biome-ignore lint/suspicious/noExplicitAny: Schema.Literal's variadic signature widens via cast.
  const literal = Schema.Literal(head as string, ...(rest as Array<string>)) as any;
  const out: Record<string, Schema.Schema.Any> = {};
  for (const [key, field] of Object.entries(fields)) {
    const annotations = field.ast.annotations as Readonly<Record<symbol, unknown>>;
    const meta = annotations[VoilaField] as FieldMeta | undefined;
    const inner = annotations[VoilaInner] as Schema.Schema.Any | undefined;
    if (meta?.localized && inner !== undefined) {
      out[key] = Schema.Record({ key: literal, value: inner }).pipe(
        Schema.annotations({ [VoilaField]: meta, [VoilaInner]: inner }),
      );
    } else {
      out[key] = field;
    }
  }
  return out;
};

const narrowCollectionsRuntime = (
  collections: CollectionMap,
  locales: ReadonlyArray<Locale>,
): CollectionMap => {
  const out: Record<string, Collection> = {};
  for (const [key, col] of Object.entries(collections)) {
    out[key] = { ...col, fields: narrowFieldsRuntime(col.fields, locales) };
  }
  return out;
};

const narrowSingletonsRuntime = (
  singletons: SingletonMap,
  locales: ReadonlyArray<Locale>,
): SingletonMap => {
  const out: Record<string, Singleton> = {};
  for (const [key, sg] of Object.entries(singletons)) {
    out[key] = { ...sg, fields: narrowFieldsRuntime(sg.fields, locales) };
  }
  return out;
};

/**
 * Builds the normalized config. Walks every collection/singleton and, when
 * `i18n.locales` is set, rewraps each localized field's `Schema.Record` with
 * `Schema.Literal(...locales)` as the key — narrowing both the runtime
 * validation and the inferred TS type to the selected locales.
 */
export const defineConfig = <
  const Locales extends ReadonlyArray<Locale>,
  // biome-ignore lint/complexity/noBannedTypes: empty-object default lets `defineConfig` accept configs without collections.
  const Collections extends CollectionMap = {},
  // biome-ignore lint/complexity/noBannedTypes: empty-object default lets `defineConfig` accept configs without singletons.
  const Singletons extends SingletonMap = {},
>(
  config: Config<Locales, Collections, Singletons>,
): NormalizedConfig<Locales, Collections, Singletons> => {
  const locales = config.i18n?.locales ?? [];
  const rawCollections = config.collections ?? ({} as Collections);
  const rawSingletons = config.singletons ?? ({} as Singletons);
  return {
    branding: config.branding,
    i18n: config.i18n,
    collections: narrowCollectionsRuntime(rawCollections, locales) as NarrowCollections<
      Collections,
      Locales[number]
    >,
    singletons: narrowSingletonsRuntime(rawSingletons, locales) as NarrowSingletons<
      Singletons,
      Locales[number]
    >,
  };
};
