// @voila/content — umbrella package barrel (M0).
// Design: products/content.voila.dev/docs/pivot/packages/content.md

// Re-export schema field constructors per the design doc's subpath table.
// `@voila/content-schema` is the source of truth (L1). When it ships its M0
// surface (`string`, `number`, `boolean`, `date`, `datetime`, `json`, `slug`,
// `select`, `defineField`, `InferDoc`, `InferField`, `Locale`, `VoilaField`,
// `getFieldMeta`), this `export *` picks them up automatically.
export * from "@voila/content-schema";
// Core runtime composition + service Tags/Layers.
export * from "./define.ts";
export type { DefineTaskOpts, MessageBatch, QueueShape, TaskDefinition } from "./queue/inline.ts";
// Background tasks — Queue Tag, InlineLive, defineTask.
// `CloudflareQueuesLive` lives at the `/queue/cloudflare` subpath (heavy adapter).
export { defineTask, InlineLive, Queue } from "./queue/inline.ts";
export * from "./services/index.ts";
