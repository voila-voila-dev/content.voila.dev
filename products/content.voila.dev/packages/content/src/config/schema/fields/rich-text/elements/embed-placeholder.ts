import { element, type Infer, optional, str } from "../_core";

export const embedPlaceholder = element("embed-placeholder", {
  provider: optional(str()),
});

export type EmbedPlaceholderElement = Infer<ReturnType<typeof embedPlaceholder.build>>;
