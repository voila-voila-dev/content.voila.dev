import type { Field } from "./_base";

/**
 * Field map — each value is a voila {@link Field} (a Standard Schema carrying
 * `meta`). Uses the wide `Field` (= `Field<unknown>`) as the "any field" bound
 * so concrete field constructors assign without a variance dance, exactly like
 * the old `Schema.Schema.Any`.
 */
export type FieldsMap = Readonly<Record<string, Field>>;
