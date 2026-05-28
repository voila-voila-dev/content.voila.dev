// @voila/content/services/document — DocumentService Tag + default Layer.
// Real read-path implementation lands in M1; M0 ships the surface so consumers
// can resolve the Layer and inspect the methods (which die with "M1").

import { Context, Effect, Layer } from "effect";
import type { DatabaseService, ListOpts, ListResult, Row } from "./database.ts";
import { Database } from "./database.ts";

export interface DocumentServiceShape {
  readonly list: (collection: string, opts?: ListOpts) => Effect.Effect<ListResult, unknown>;
  readonly get: (collection: string, id: string) => Effect.Effect<Row | null, unknown>;
  readonly findOne: (
    collection: string,
    query: { readonly field: string; readonly value: unknown },
  ) => Effect.Effect<Row | null, unknown>;
}

type DocumentServiceBase = Context.TagClass<
  DocumentService,
  "@voila/content/DocumentService",
  DocumentServiceShape
>;
const DocumentServiceBase: DocumentServiceBase = Context.Tag("@voila/content/DocumentService")<
  DocumentService,
  DocumentServiceShape
>();
export class DocumentService extends DocumentServiceBase {}

const m1 = <A>(): Effect.Effect<A, unknown> =>
  Effect.die("DocumentService: not implemented in M0 (lands in M1)");

export const DocumentLive: Layer.Layer<DocumentService, never, DatabaseService> = Layer.effect(
  DocumentService,
  Effect.gen(function* () {
    // Resolve Database to declare the dependency edge, even though M0 stubs ignore it.
    yield* Database;
    return {
      list: () => m1<ListResult>(),
      get: () => m1<Row | null>(),
      findOne: () => m1<Row | null>(),
    };
  }),
);
