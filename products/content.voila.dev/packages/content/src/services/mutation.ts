// @voila/content/services/mutation — MutationService Tag + default Layer.
// Real write-path lands in M2 (with Schema.decodeUnknown gating + envelopes).

import { Context, Effect, Layer } from "effect";
import type { DatabaseService, Row } from "./database.ts";
import { Database } from "./database.ts";
import { DocumentService } from "./document.ts";

export interface MutationServiceShape {
  readonly create: (collection: string, data: Row) => Effect.Effect<Row, unknown>;
  readonly update: (
    collection: string,
    id: string,
    patch: Partial<Row>,
  ) => Effect.Effect<Row, unknown>;
  readonly softDelete: (collection: string, id: string) => Effect.Effect<void, unknown>;
  readonly restore: (collection: string, id: string) => Effect.Effect<Row, unknown>;
}

type MutationServiceBase = Context.TagClass<
  MutationService,
  "@voila/content/MutationService",
  MutationServiceShape
>;
const MutationServiceBase: MutationServiceBase = Context.Tag("@voila/content/MutationService")<
  MutationService,
  MutationServiceShape
>();
export class MutationService extends MutationServiceBase {}

const m2 = <A>(): Effect.Effect<A, unknown> =>
  Effect.die("MutationService: not implemented in M0 (lands in M2)");

export const MutationLive: Layer.Layer<MutationService, never, DocumentService | DatabaseService> =
  Layer.effect(
    MutationService,
    Effect.gen(function* () {
      yield* DocumentService;
      yield* Database;
      return {
        create: () => m2<Row>(),
        update: () => m2<Row>(),
        softDelete: () => m2<void>(),
        restore: () => m2<Row>(),
      };
    }),
  );
