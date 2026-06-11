export type { Branding } from "./config/branding";
export type { CollectionMap, Config, NormalizedConfig, SingletonMap } from "./config/config";
export { defineConfig } from "./config/config";
export type { I18nConfig } from "./config/i18n";
export type { Collection, CollectionDef } from "./config/schema/collection";
export { defineCollection } from "./config/schema/collection";
// Shared field types stay top-level so consumers can import them directly
// without reaching through the namespace.
export type {
  AccessibleFields,
  BaseFieldOpts,
  Field,
  FieldAccess,
  FieldAccessContext,
  FieldAccessPrincipal,
  FieldMeta,
  FieldMetaBase,
  FieldsMap,
  FieldTransform,
  Locale,
  Localized,
  LocalizedMarker,
  WithLocalized,
} from "./config/schema/fields";
// Field constructors live one-per-file under ./config/schema/fields and are surfaced
// as a single `fields` namespace. Localized fields start out as the wide
// `Schema<Record<Locale, T>>` shape; `defineConfig` reads the `i18n.locales`
// tuple and narrows them to `Schema<Record<Locales[number], T>>` per project.
export * as fields from "./config/schema/fields";
export {
  accessibleFields,
  canReadField,
  canWriteField,
  isLocale,
  LOCALES,
} from "./config/schema/fields";
// Rich-text elements + marks + extension helpers. Pass these to
// `fields.richText({ elements, marks })` to restrict a field, or use
// `rt.defineElement` / `rt.defineMark` to introduce custom kinds.
export * as rt from "./config/schema/fields/rich-text";
export type { InferDoc, InferDrafts, InferFields, InferSingleton } from "./config/schema/infer";
export type { Singleton, SingletonDef } from "./config/schema/singleton";
export { defineSingleton } from "./config/schema/singleton";
