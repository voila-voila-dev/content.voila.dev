// Handler layer for `voilaRpc`. Read procedures delegate to the shared read core
// (`./read-core`); write procedures to the write core (`./write-core`). Both query
// the `Database`, map `DatabaseError`s to typed RPC errors, and decode rows through
// the collection's document schema. The REST `HttpApi` (`./httpapi`) reuses the read
// core, so the transports never diverge on read semantics.

import type { Rpc } from "@effect/rpc";
import type { Layer } from "effect";
import type { NormalizedConfig } from "../config/config";
import type { Database, FieldValue } from "../sql/database";
import { type ListArgs, makeReadCore } from "./read-core";
import { makeVoilaRpc } from "./rpc";
import type { VoilaRpcs } from "./types";
import { makeWriteCore } from "./write-core";

/** The handler `Layer` for `voilaRpc`, requiring a `Database`. */
export const makeVoilaRpcHandlers = <C extends NormalizedConfig>(
  config: C,
): Layer.Layer<Rpc.ToHandler<VoilaRpcs<C>>, never, Database> => {
  const group = makeVoilaRpc(config);
  const core = makeReadCore(config);
  const writes = makeWriteCore(config);

  const handlersFor = (slug: string) => ({
    [`${slug}.list`]: (payload: ListArgs) => core.list(slug, payload),
    [`${slug}.find`]: (payload: { readonly id: string }) => core.find(slug, payload.id),
    [`${slug}.findOne`]: (payload: { readonly field: string; readonly value: FieldValue }) =>
      core.findOne(slug, payload.field, payload.value),
    [`${slug}.create`]: (payload: { readonly data: unknown }) => writes.create(slug, payload.data),
    [`${slug}.update`]: (payload: { readonly id: string; readonly data: unknown }) =>
      writes.update(slug, payload.id, payload.data),
    [`${slug}.delete`]: (payload: { readonly id: string; readonly hard?: boolean }) =>
      writes.delete(slug, payload.id, payload.hard ?? false),
    [`${slug}.restore`]: (payload: { readonly id: string }) => writes.restore(slug, payload.id),
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
