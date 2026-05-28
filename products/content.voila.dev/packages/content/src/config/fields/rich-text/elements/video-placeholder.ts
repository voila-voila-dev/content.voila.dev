import type { Schema } from "effect";
import { element } from "../_core";

export const videoPlaceholder = element("video-placeholder", {});

export type VideoPlaceholderElement = Schema.Schema.Type<ReturnType<typeof videoPlaceholder.build>>;
