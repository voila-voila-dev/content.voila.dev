import { alignSchema, element, type Infer, optional } from "../_core";

export const heading5 = element("heading-5", {
  align: optional(alignSchema),
});

export type Heading5Element = Infer<ReturnType<typeof heading5.build>>;
