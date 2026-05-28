import { Schema } from "effect";
import { element } from "../_core";

export const image = element("image", {
  url: Schema.String,
  alt: Schema.optional(Schema.String),
  caption: Schema.optional(Schema.String),
  width: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  height: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
});

export type ImageElement = Schema.Schema.Type<ReturnType<typeof image.build>>;
