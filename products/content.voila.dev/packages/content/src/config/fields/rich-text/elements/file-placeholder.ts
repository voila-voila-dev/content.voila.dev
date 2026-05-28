import { Schema } from "effect";
import { element } from "../_core";

export const filePlaceholder = element("file-placeholder", {
  fileName: Schema.optional(Schema.String),
});

export type FilePlaceholderElement = Schema.Schema.Type<ReturnType<typeof filePlaceholder.build>>;
