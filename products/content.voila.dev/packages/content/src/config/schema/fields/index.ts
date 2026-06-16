// `import { fields } from "@voila/content"` — every constructor lives in its
// own file (see ./<name>.ts) and is re-exported under the canonical name here.

export type { AccessibleFields } from "./_access";
export { accessibleFields, canReadField, canWriteField } from "./_access";
export type {
  FieldAccess,
  FieldAccessContext,
  FieldAccessPrincipal,
  FieldMeta,
  FieldMetaBase,
  FieldTransform,
} from "./_annotation";
export type { BaseFieldOpts, Field, WithLocalized } from "./_base";
export { makeField } from "./_base";
export { isLocale, LOCALES, type Locale } from "./_locale";
export type { Localized, LocalizedMarker, NarrowField, NarrowFields } from "./_localized";
export type { FieldsMap } from "./_map";
// Image-CDN transform URLs (render-time variants for media fields)
export {
  type CloudflareImageCdnOpts,
  cloudflareImageCdn,
  cloudflareImageOptions,
  type ImageCdn,
  mediaVariantUrls,
} from "./_media-cdn";
// Structured
export { type ArrayOpts, array } from "./array";
export { type BooleanOpts, boolean } from "./boolean";
export { type CodeLanguage, type CodeOpts, code } from "./code";
export { type ColorFormat, type ColorOpts, color } from "./color";
export { type DateOpts, date } from "./date";
export { type DateTimeOpts, datetime } from "./datetime";
export { type DurationOpts, duration } from "./duration";
// `enum` is a reserved word; the file exports `enum_` and we re-export it
// under the public name with a renamed binding.
export { type EnumLike, type EnumOpts, enum_ as enum } from "./enum";
export { type IdOpts, id } from "./id";
export { type JsonOpts, json } from "./json";
export { type MarkdownFlavor, type MarkdownOpts, markdown } from "./markdown";
// Media
export {
  type MediaFit,
  type MediaFormat,
  type MediaOpts,
  type MediaTransform,
  type MediaValue,
  media,
} from "./media";
export { type MultiSelectOpts, multiSelect } from "./multi-select";
export { type NumberOpts, number } from "./number";
export { type ObjectOpts, type ObjectShape, object } from "./object";
export { type PasswordHash, type PasswordOpts, password } from "./password";
export { type PolymorphicOpts, type PolymorphicRef, polymorphic } from "./polymorphic";
// Specialized
export { type Position, type PositionOpts, position } from "./position";
// Relations
export { type OnDelete, type RelationOpts, relation } from "./relation";
export type {
  RichTextElement,
  RichTextElementDef,
  RichTextLeaf,
  RichTextMarkDef,
  RichTextNode,
  RichTextValue,
} from "./rich-text";
// Rich content — only the field + its TS types leak into the `fields`
// namespace. Every element / mark / extension helper lives behind the
// `rt` namespace exposed from the package root.
export { type RichTextOpts, richText } from "./rich-text";
export { type SecretOpts, secret } from "./secret";
// Selections
export { type SelectOpts, select } from "./select";
// Identifiers
export { type SlugMeta, type SlugOpts, slug, slugify } from "./slug";
// Primitives
export { type StringFormat, type StringOpts, string } from "./string";
export { type TimeOpts, time } from "./time";
