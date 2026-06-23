import { element, type Infer, min, num, optional, refine, str } from "../_core";

export const file = element("file", {
  url: str(),
  name: str(),
  size: optional(refine(num(), min(0))),
  mime: optional(str()),
});

export type FileElement = Infer<ReturnType<typeof file.build>>;
