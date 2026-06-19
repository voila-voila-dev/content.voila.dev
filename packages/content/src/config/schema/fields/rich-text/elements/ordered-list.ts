import { element, type Infer, integer, min, num, optional, refine } from "../_core";

export const orderedList = element("ordered-list", {
  start: optional(refine(num(), integer(), min(0))),
});

export type OrderedListElement = Infer<ReturnType<typeof orderedList.build>>;
