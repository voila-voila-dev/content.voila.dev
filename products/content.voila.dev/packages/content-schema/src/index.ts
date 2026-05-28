// @voila/content-schema — public entry point.
//
// L1 of the engine layer cake: field constructors as annotated `effect/Schema`s,
// `InferDoc` / `InferField` for type derivation, `defineField` for third-party
// kinds, and `getFieldMeta` for reading the `VoilaField` annotation.
//
// Design: docs/pivot/packages/content-schema.md
//         docs/pivot/effect-architecture-canon.md §3, §4

import { Schema } from "effect";

export type {
  BaseFieldMeta,
  BooleanFieldMeta,
  DateFieldMeta,
  DateTimeFieldMeta,
  FieldMeta,
  JsonFieldMeta,
  NumberFieldMeta,
  SelectFieldMeta,
  SelectOption,
  SlugFieldMeta,
  StringFieldMeta,
} from "./annotation.ts";
// Annotation namespace + meta types.
export { VoilaField } from "./annotation.ts";
export type { FieldFactory } from "./define-field.ts";
// Custom kinds + annotation reader.
export { defineField } from "./define-field.ts";
export type {
  BooleanFieldOpts,
  DateFieldOpts,
  DateTimeFieldOpts,
  JsonFieldOpts,
  NumberFieldOpts,
  SelectFieldOpts,
  SelectOptionInput,
  SlugFieldOpts,
  StringFieldOpts,
} from "./fields/index.ts";
// Field constructors (one file each, re-exported via the barrel).
export {
  boolean,
  date,
  datetime,
  json,
  number,
  SLUG_PATTERN,
  select,
  slug,
  string,
} from "./fields/index.ts";
export { getFieldMeta } from "./get-field-meta.ts";

// Inference helpers.
export type { InferDoc, InferField } from "./infer.ts";

// Branded locale identifier.
export type { Locale } from "./locale.ts";

// Re-export `Schema` itself and the Standard-Schema view so the Head/forms
// can adapt without a second import.
export { Schema };
export const standardSchemaV1: typeof Schema.standardSchemaV1 = Schema.standardSchemaV1;
