import { element, type Infer, optional, str } from "../_core";

export const mention = element("mention", {
  /** Source collection slug (e.g. `"users"`, `"tags"`). */
  source: str(),
  /** The referenced record's id (or any application-defined value). */
  value: str(),
  /** Display label shown inline; defaults to the resolved record's label. */
  label: optional(str()),
});

export type MentionElement = Infer<ReturnType<typeof mention.build>>;
