import { Schema } from "effect";
import { element } from "../_core";

export const mention = element("mention", {
  /** Source collection slug (e.g. `"users"`, `"tags"`). */
  source: Schema.String,
  /** The referenced record's id (or any application-defined value). */
  value: Schema.String,
  /** Display label shown inline; defaults to the resolved record's label. */
  label: Schema.optional(Schema.String),
});

export type MentionElement = Schema.Schema.Type<ReturnType<typeof mention.build>>;
