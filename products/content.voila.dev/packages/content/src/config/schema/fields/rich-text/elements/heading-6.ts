import { Schema } from "effect";
import { alignSchema, element } from "../_core";

export const heading6 = element("heading-6", {
  align: Schema.optional(alignSchema),
});

export type Heading6Element = Schema.Schema.Type<ReturnType<typeof heading6.build>>;
