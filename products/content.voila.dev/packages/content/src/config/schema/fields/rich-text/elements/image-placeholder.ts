import { element, type Infer } from "../_core";

export const imagePlaceholder = element("image-placeholder", {});

export type ImagePlaceholderElement = Infer<ReturnType<typeof imagePlaceholder.build>>;
