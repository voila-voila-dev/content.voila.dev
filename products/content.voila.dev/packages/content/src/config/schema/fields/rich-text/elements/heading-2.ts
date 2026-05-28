import { Schema } from "effect";
import { alignSchema, element } from "../_core";

export const heading2 = element("heading-2", {
  align: Schema.optional(alignSchema),
});

export type Heading2Element = Schema.Schema.Type<ReturnType<typeof heading2.build>>;
