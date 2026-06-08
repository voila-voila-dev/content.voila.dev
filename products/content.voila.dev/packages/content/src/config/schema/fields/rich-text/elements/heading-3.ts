import { alignSchema, element, type Infer, optional } from "../_core";

export const heading3 = element("heading-3", {
  align: optional(alignSchema),
});

export type Heading3Element = Infer<ReturnType<typeof heading3.build>>;
