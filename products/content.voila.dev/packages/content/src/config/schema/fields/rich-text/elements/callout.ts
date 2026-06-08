import { element, type Infer, optional, str } from "../_core";

export const callout = element("callout", {
  /** Emoji rendered at the start of the callout (e.g. `"💡"`, `"⚠️"`). */
  icon: str(),
  /** Optional background — any CSS color expression or design-system token. */
  bgColor: optional(str()),
});

export type CalloutElement = Infer<ReturnType<typeof callout.build>>;
