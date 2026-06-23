import { element, type Infer, literal, optional, str } from "../_core";

export const link = element("link", {
  url: str(),
  title: optional(str()),
  target: optional(literal("_self", "_blank")),
});

export type LinkElement = Infer<ReturnType<typeof link.build>>;
