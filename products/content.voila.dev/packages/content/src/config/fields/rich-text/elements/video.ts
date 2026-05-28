import { Schema } from "effect";
import { element } from "../_core";

export const video = element("video", {
  url: Schema.String,
  caption: Schema.optional(Schema.String),
  poster: Schema.optional(Schema.String),
});

export type VideoElement = Schema.Schema.Type<ReturnType<typeof video.build>>;
