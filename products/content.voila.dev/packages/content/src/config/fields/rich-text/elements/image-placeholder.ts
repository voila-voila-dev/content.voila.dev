import type { Schema } from "effect";
import { element } from "../_core";

export const imagePlaceholder = element("image-placeholder", {});

export type ImagePlaceholderElement = Schema.Schema.Type<ReturnType<typeof imagePlaceholder.build>>;
