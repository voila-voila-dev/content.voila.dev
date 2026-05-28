import { Schema } from "effect";
import { element } from "../_core";

export const embedPlaceholder = element("embed-placeholder", {
  provider: Schema.optional(Schema.String),
});

export type EmbedPlaceholderElement = Schema.Schema.Type<ReturnType<typeof embedPlaceholder.build>>;
