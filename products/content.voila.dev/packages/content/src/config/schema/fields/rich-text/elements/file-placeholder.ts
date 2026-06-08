import { element, type Infer, optional, str } from "../_core";

export const filePlaceholder = element("file-placeholder", {
  fileName: optional(str()),
});

export type FilePlaceholderElement = Infer<ReturnType<typeof filePlaceholder.build>>;
