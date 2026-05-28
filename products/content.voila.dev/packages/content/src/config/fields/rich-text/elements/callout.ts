import { Schema } from "effect";
import { element } from "../_core";

export const callout = element("callout", {
  /** Emoji rendered at the start of the callout (e.g. `"💡"`, `"⚠️"`). */
  icon: Schema.String,
  /** Optional background — any CSS color expression or design-system token. */
  bgColor: Schema.optional(Schema.String),
});

export type CalloutElement = Schema.Schema.Type<ReturnType<typeof callout.build>>;
