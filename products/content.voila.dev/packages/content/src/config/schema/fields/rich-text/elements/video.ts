import { element, type Infer, optional, str } from "../_core";

export const video = element("video", {
  url: str(),
  caption: optional(str()),
  poster: optional(str()),
});

export type VideoElement = Infer<ReturnType<typeof video.build>>;
