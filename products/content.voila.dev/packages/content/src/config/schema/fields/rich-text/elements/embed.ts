import { element, type Infer, optional, str } from "../_core";

/**
 * Framework-neutral embed — `provider` names whichever external service the
 * URL belongs to (`"youtube"`, `"vimeo"`, `"twitter"`, …). The Head decides
 * how to render each provider; the data layer only stores the reference.
 */
export const embed = element("embed", {
  provider: str(),
  url: str(),
  caption: optional(str()),
});

export type EmbedElement = Infer<ReturnType<typeof embed.build>>;
