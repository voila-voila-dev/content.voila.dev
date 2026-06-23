import { element, type Infer, optional, str } from "../_core";

export const blockquote = element("blockquote", {
  cite: optional(str()),
});

export type BlockquoteElement = Infer<ReturnType<typeof blockquote.build>>;
