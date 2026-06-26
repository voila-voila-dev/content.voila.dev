export type { Branding } from "./branding";
export type { CollectionMap, Config, NormalizedConfig, SingletonMap } from "./config";
export { defineConfig } from "./config";
export type { I18nConfig } from "./i18n";
export { localeChain } from "./i18n";
export { localizeDocument } from "./localize";
export type { MapConfig } from "./map";
export type { GroupDef } from "./schema/_groups";
export type { Collection, CollectionDef } from "./schema/collection";
export { defineCollection } from "./schema/collection";
export type {
  AccessibleFields,
  BaseFieldOpts,
  FieldAccess,
  FieldAccessContext,
  FieldAccessPrincipal,
  FieldMeta,
  FieldsMap,
  FieldTransform,
  Locale,
  Localized,
  LocalizedMarker,
  WithLocalized,
} from "./schema/fields";
export * as fields from "./schema/fields";
export { accessibleFields, canReadField, canWriteField, isLocale, LOCALES } from "./schema/fields";
export type {
  InferDoc,
  InferFields,
  InferLocalizedDoc,
  InferLocalizedFields,
  InferLocalizedSingleton,
  InferSingleton,
} from "./schema/infer";
export type { Singleton, SingletonDef } from "./schema/singleton";
export { defineSingleton } from "./schema/singleton";
