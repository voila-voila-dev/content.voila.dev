import { Schema } from "effect";
import { alignSchema, element } from "../_core";

export const heading4 = element("heading-4", {
  align: Schema.optional(alignSchema),
});

export type Heading4Element = Schema.Schema.Type<ReturnType<typeof heading4.build>>;
