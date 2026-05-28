import { Schema } from "effect";
import { element } from "../_core";

export const link = element("link", {
  url: Schema.String,
  title: Schema.optional(Schema.String),
  target: Schema.optional(Schema.Union(Schema.Literal("_self"), Schema.Literal("_blank"))),
});

export type LinkElement = Schema.Schema.Type<ReturnType<typeof link.build>>;
