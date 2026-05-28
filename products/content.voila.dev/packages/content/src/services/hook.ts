// @voila/content/services/hook — HookService Tag + default (no-op) Layer.

import { Context, Effect, Layer } from "effect";
import type { Row } from "./database.ts";

export interface HookContext {
  readonly collection: string;
  readonly subject?: { readonly id: string } | null;
}

export interface HookServiceShape {
  readonly beforeCreate: (ctx: HookContext, data: Row) => Effect.Effect<Row, never>;
  readonly afterCreate: (ctx: HookContext, doc: Row) => Effect.Effect<void, never>;
  readonly beforeUpdate: (
    ctx: HookContext,
    id: string,
    patch: Partial<Row>,
  ) => Effect.Effect<Partial<Row>, never>;
  readonly afterUpdate: (ctx: HookContext, doc: Row) => Effect.Effect<void, never>;
  readonly beforeDelete: (ctx: HookContext, id: string) => Effect.Effect<void, never>;
}

type HookServiceBase = Context.TagClass<
  HookService,
  "@voila/content/HookService",
  HookServiceShape
>;
const HookServiceBase: HookServiceBase = Context.Tag("@voila/content/HookService")<
  HookService,
  HookServiceShape
>();
export class HookService extends HookServiceBase {}

/** Default no-op Layer — passes inputs through unchanged. Compose to add hooks. */
export const HookLive: Layer.Layer<HookService> = Layer.succeed(HookService, {
  beforeCreate: (_ctx, data) => Effect.succeed(data),
  afterCreate: () => Effect.void,
  beforeUpdate: (_ctx, _id, patch) => Effect.succeed(patch),
  afterUpdate: () => Effect.void,
  beforeDelete: () => Effect.void,
});
