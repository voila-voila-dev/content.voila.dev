import { alignSchema, element, type Infer, optional } from "../_core";

export const heading4 = element("heading-4", {
  align: optional(alignSchema),
});

export type Heading4Element = Infer<ReturnType<typeof heading4.build>>;
