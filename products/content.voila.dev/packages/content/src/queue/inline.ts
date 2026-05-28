// @voila/content/queue/inline — Queue Tag + InlineLive Layer (M0 stub).
// Real task execution / batching lands in M5. M0 ships the surface so consumers
// can `defineTask(...)` and wire `InlineLive([tasks])` without errors.

import type { Schema } from "effect";
import { Context, Effect, Layer } from "effect";

/** Opaque branded task definition; payload type is captured in `P`. */
export interface TaskDefinition<P> {
  readonly name: string;
  readonly schema: Schema.Schema<P>;
  readonly handler: (payload: P) => Effect.Effect<void, never, never>;
  readonly retry?: {
    readonly attempts: number;
    readonly backoff?: "exponential" | "linear";
  };
  readonly dlq?: string;
}

export interface DefineTaskOpts<P> {
  readonly name: string;
  readonly schema: Schema.Schema<P>;
  readonly handler: (payload: P) => Effect.Effect<void, never, never>;
  readonly retry?: {
    readonly attempts: number;
    readonly backoff?: "exponential" | "linear";
  };
  readonly dlq?: string;
}

/** Register a named background task with payload schema + handler. */
export const defineTask = <P>(opts: DefineTaskOpts<P>): TaskDefinition<P> => ({
  name: opts.name,
  schema: opts.schema,
  handler: opts.handler,
  retry: opts.retry,
  dlq: opts.dlq,
});

export interface MessageBatch<T> {
  readonly messages: ReadonlyArray<{ readonly body: T }>;
}

export interface QueueShape {
  readonly enqueue: <P>(task: TaskDefinition<P>, payload: P) => Effect.Effect<void, unknown>;
  readonly consume: (batch: MessageBatch<unknown>) => Effect.Effect<void, unknown>;
}

type QueueBase = Context.TagClass<Queue, "@voila/content/Queue", QueueShape>;
const QueueBase: QueueBase = Context.Tag("@voila/content/Queue")<Queue, QueueShape>();
export class Queue extends QueueBase {}

/**
 * Inline queue Layer — runs handlers synchronously in-process. M0 stub that
 * accepts a `tasks` array (validated lookup lands in M5); for now `enqueue`
 * looks up the task by name and runs the handler immediately, `consume` is a
 * no-op so callers can wire the Layer without crashing.
 */
export const InlineLive = (
  tasks: ReadonlyArray<TaskDefinition<unknown>> = [],
): Layer.Layer<Queue> => {
  // The registry stores `TaskDefinition<unknown>` because the heterogenous
  // payload types collapse into a single `Map`. Per the contract of
  // `defineTask`, a name uniquely identifies a `(schema, handler<P>)` pair —
  // so when `enqueue(task, payload)` looks up by `task.name`, the stored
  // entry is guaranteed to carry the same `P`. M5 replaces this lookup with
  // a `Schema.decode` of an inbound message payload, at which point the
  // re-narrowing happens through the decoder rather than through the cast.
  const byName: Map<string, TaskDefinition<unknown>> = new Map(tasks.map((t) => [t.name, t]));
  return Layer.succeed(Queue, {
    enqueue: <P>(task: TaskDefinition<P>, payload: P) =>
      Effect.gen(function* () {
        const found = byName.get(task.name);
        if (found === undefined) {
          // Allow ad-hoc enqueue of unregistered tasks for now — the caller
          // already carries the typed handler, so no narrowing is needed.
          yield* task.handler(payload);
          return;
        }
        // Re-narrow the erased entry; see the comment on `byName` above.
        yield* (found.handler as (p: P) => Effect.Effect<void, never, never>)(payload);
      }),
    consume: () => Effect.void,
  });
};
