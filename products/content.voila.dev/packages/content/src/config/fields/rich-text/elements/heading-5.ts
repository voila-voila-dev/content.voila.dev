import { Schema } from "effect";
import { alignSchema, element } from "../_core";

export const heading5 = element("heading-5", {
  align: Schema.optional(alignSchema),
});

export type Heading5Element = Schema.Schema.Type<ReturnType<typeof heading5.build>>;
