import { Schema } from "effect";
import { element } from "../_core";

export const file = element("file", {
  url: Schema.String,
  name: Schema.String,
  size: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  mime: Schema.optional(Schema.String),
});

export type FileElement = Schema.Schema.Type<ReturnType<typeof file.build>>;
