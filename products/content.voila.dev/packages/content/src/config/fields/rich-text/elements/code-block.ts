import { Schema } from "effect";
import { element } from "../_core";

export const codeBlock = element("code-block", {
  language: Schema.optional(Schema.String),
});

export type CodeBlockElement = Schema.Schema.Type<ReturnType<typeof codeBlock.build>>;
