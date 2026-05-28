import { Schema } from "effect";
import { element } from "../_core";

/**
 * Framework-neutral embed — `provider` names whichever external service the
 * URL belongs to (`"youtube"`, `"vimeo"`, `"twitter"`, …). The Head decides
 * how to render each provider; the data layer only stores the reference.
 */
export const embed = element("embed", {
  provider: Schema.String,
  url: Schema.String,
  caption: Schema.optional(Schema.String),
});

export type EmbedElement = Schema.Schema.Type<ReturnType<typeof embed.build>>;
