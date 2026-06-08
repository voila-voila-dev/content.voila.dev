import { element, type Infer } from "../_core";

export const videoPlaceholder = element("video-placeholder", {});

export type VideoPlaceholderElement = Infer<ReturnType<typeof videoPlaceholder.build>>;
