import { alignSchema, element, type Infer, optional } from "../_core";

export const heading1 = element("heading-1", {
  align: optional(alignSchema),
});

export type Heading1Element = Infer<ReturnType<typeof heading1.build>>;
