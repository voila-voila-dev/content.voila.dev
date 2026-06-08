import { alignSchema, element, type Infer, optional } from "../_core";

export const heading2 = element("heading-2", {
  align: optional(alignSchema),
});

export type Heading2Element = Infer<ReturnType<typeof heading2.build>>;
