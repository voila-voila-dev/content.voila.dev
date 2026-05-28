// getFieldMeta — read the VoilaField annotation off any field schema.

import type { Schema } from "effect";
import { Option, SchemaAST } from "effect";
import type { FieldMeta } from "./annotation.ts";
import { VoilaField } from "./annotation.ts";

/**
 * Extract the structured field meta from a schema that was built with one of
 * the @voila/content-schema field constructors (or via `defineField`).
 *
 * Returns `null` when the schema carries no `VoilaField` annotation (e.g.
 * a hand-rolled `Schema.String` that did not go through a field constructor).
 */
export const getFieldMeta = <M extends FieldMeta = FieldMeta>(
  schema: Schema.Schema.Any,
): M | null => {
  const option = SchemaAST.getAnnotation<M>(VoilaField)(schema.ast);
  return Option.getOrNull(option);
};
