import { Schema } from "effect";
import { alignSchema, element } from "../_core";

export const heading1 = element("heading-1", {
  align: Schema.optional(alignSchema),
});

export type Heading1Element = Schema.Schema.Type<ReturnType<typeof heading1.build>>;
