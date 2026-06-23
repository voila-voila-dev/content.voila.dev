import { alignSchema, element, type Infer, optional } from "../_core";

export const heading6 = element("heading-6", {
  align: optional(alignSchema),
});

export type Heading6Element = Infer<ReturnType<typeof heading6.build>>;
