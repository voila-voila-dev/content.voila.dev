import { Schema } from "effect";
import { element } from "../_core";

export const blockquote = element("blockquote", {
  cite: Schema.optional(Schema.String),
});

export type BlockquoteElement = Schema.Schema.Type<ReturnType<typeof blockquote.build>>;
