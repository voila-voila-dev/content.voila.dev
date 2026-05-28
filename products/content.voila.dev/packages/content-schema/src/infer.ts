// Type-level inference utilities.
//
// `InferField<F>` resolves the decoded TypeScript value type of a single
// field schema. `InferDoc<Fields>` walks a `Record<string, Schema>` map (the
// shape passed to `defineCollection({ fields })`) and produces the document
// TS type, marking fields as optional when their `VoilaField` annotation
// declares `required: false` or carries a `default`.

import type { Schema } from "effect";
import type { BaseFieldMeta } from "./annotation.ts";
import { VoilaField } from "./annotation.ts";

/**
 * Extract the decoded TypeScript value type from any field schema.
 */
export type InferField<F> = F extends Schema.Schema<infer A, infer _I, infer _R> ? A : never;

// We surface annotations via the Schema's `ast.annotations` map. effect/Schema
// types the annotation map as `{ readonly [_: symbol | string]: unknown }`, so
// we drill in with an indexed access on the `VoilaField` symbol.
type MetaOf<F> = F extends { readonly ast: { readonly annotations: infer A } }
  ? A extends { readonly [VoilaField]: infer M }
    ? M
    : never
  : never;

type IsOptional<F> =
  MetaOf<F> extends BaseFieldMeta
    ? MetaOf<F>["required"] extends false
      ? true
      : MetaOf<F> extends { readonly default: undefined }
        ? false
        : undefined extends MetaOf<F>["default"]
          ? false
          : true
    : false;

type RequiredKeys<Fields> = {
  [K in keyof Fields]: IsOptional<Fields[K]> extends true ? never : K;
}[keyof Fields];

type OptionalKeys<Fields> = {
  [K in keyof Fields]: IsOptional<Fields[K]> extends true ? K : never;
}[keyof Fields];

/**
 * Walk a `Record<string, Schema>` field map and produce the document type.
 *
 * Fields whose meta declares `required: false` *or* a non-undefined `default`
 * become optional in the resulting type; everything else is required.
 */
export type InferDoc<Fields extends Record<string, Schema.Schema.Any>> = {
  [K in RequiredKeys<Fields>]: InferField<Fields[K]>;
} & {
  [K in OptionalKeys<Fields>]?: InferField<Fields[K]>;
};
