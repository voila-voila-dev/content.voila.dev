import { element, type Infer, min, num, optional, refine, str } from "../_core";

export const image = element("image", {
  url: str(),
  alt: optional(str()),
  caption: optional(str()),
  width: optional(refine(num(), min(0))),
  height: optional(refine(num(), min(0))),
});

export type ImageElement = Infer<ReturnType<typeof image.build>>;
