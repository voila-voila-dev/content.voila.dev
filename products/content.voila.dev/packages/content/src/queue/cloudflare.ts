// @voila/content/queue/cloudflare — CloudflareQueuesLive Layer (M0 stub).
//
// IMPORTANT: do NOT import `cloudflare:workers` here in M0 — keep this module
// importable in any environment (node, bun, browser) so type-checking and
// tests don't blow up on the missing virtual module. The real binding wiring
// lands in M5.

import { Effect, Layer } from "effect";
import { Queue, type TaskDefinition } from "./inline.ts";

/** Opaque shape of a Cloudflare Queue binding — typed loosely so we don't depend on `@cloudflare/workers-types`. */
export interface CloudflareQueueBinding {
  readonly send: (body: unknown, opts?: unknown) => Promise<void>;
  readonly sendBatch: (messages: ReadonlyArray<{ readonly body: unknown }>) => Promise<void>;
}

export interface CloudflareQueuesOpts {
  readonly queue: CloudflareQueueBinding;
  readonly tasks: ReadonlyArray<TaskDefinition<unknown>>;
}

/**
 * Cloudflare Queues Layer — M0 stub. `enqueue` proxies to the binding's
 * `.send`; `consume` is a no-op until M5 fills in the consumer loop.
 */
export const CloudflareQueuesLive = (opts: CloudflareQueuesOpts): Layer.Layer<Queue> =>
  Layer.succeed(Queue, {
    enqueue: <P>(task: TaskDefinition<P>, payload: P) =>
      Effect.tryPromise({
        try: () => opts.queue.send({ name: task.name, payload }),
        catch: (cause) => cause,
      }),
    consume: () => Effect.void,
  });
