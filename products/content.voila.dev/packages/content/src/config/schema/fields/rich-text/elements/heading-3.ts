import { Schema } from "effect";
import { alignSchema, element } from "../_core";

export const heading3 = element("heading-3", {
  align: Schema.optional(alignSchema),
});

export type Heading3Element = Schema.Schema.Type<ReturnType<typeof heading3.build>>;
