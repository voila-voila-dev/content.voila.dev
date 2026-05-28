import type { Schema } from "effect";

/**
 * Field map — each value is an annotated effect/Schema.
 *
 * Uses `Schema.Schema.Any` (the canonical "any schema" type from effect) so
 * concrete field constructors assign cleanly without a variance dance.
 */
export type FieldsMap = Readonly<Record<string, Schema.Schema.Any>>;
