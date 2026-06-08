import { element, type Infer, optional, str } from "../_core";

export const codeBlock = element("code-block", {
  language: optional(str()),
});

export type CodeBlockElement = Infer<ReturnType<typeof codeBlock.build>>;
