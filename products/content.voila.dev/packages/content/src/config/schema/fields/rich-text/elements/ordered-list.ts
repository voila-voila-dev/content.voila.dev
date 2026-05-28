import { Schema } from "effect";
import { element } from "../_core";

export const orderedList = element("ordered-list", {
  start: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
});

export type OrderedListElement = Schema.Schema.Type<ReturnType<typeof orderedList.build>>;
