// Handler layer for `voilaRpc`. Each procedure delegates to the shared read core
// (`./read-core`) — which queries the `Database`, maps `DatabaseError` to a typed
// RPC error, and decodes rows through the collection's document schema. The REST
// `HttpApi` (`./httpapi`) delegates to the same core, so the two transports never
// diverge on read semantics.

import type { Rpc } from "@effect/rpc";
import type { Layer } from "effect";
import type { NormalizedConfig } from "../config/config";
import type { Database, FieldValue } from "../sql/database";
import { type ListArgs, makeReadCore } from "./read-core";
import { makeVoilaRpc } from "./rpc";
import type { VoilaRpcs } from "./types";

/** The handler `Layer` for `voilaRpc`, requiring a `Database`. */
export const makeVoilaRpcHandlers = <C extends NormalizedConfig>(
  config: C,
): Layer.Layer<Rpc.ToHandler<VoilaRpcs<C>>, never, Database> => {
  const group = makeVoilaRpc(config);
  const core = makeReadCore(config);

  const handlersFor = (slug: string) => ({
    [`${slug}.list`]: (payload: ListArgs) => core.list(slug, payload),
    [`${slug}.find`]: (payload: { readonly id: string }) => core.find(slug, payload.id),
    [`${slug}.findOne`]: (payload: { readonly field: string; readonly value: FieldValue }) =>
      core.findOne(slug, payload.field, payload.value),
  });

  const handlers = Object.assign({}, ...Object.keys(config.collections).map(handlersFor));
  // Tags are generated at runtime, so the handler record is keyed by string and
  // cannot be statically matched to the group — the cast is the seam.
  return group.toLayer(handlers as never) as Layer.Layer<
    Rpc.ToHandler<VoilaRpcs<C>>,
    never,
    Database
  >;
};
