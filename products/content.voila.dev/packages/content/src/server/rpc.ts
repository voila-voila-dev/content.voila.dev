// `voilaRpc` — the read-path `RpcGroup`. One procedure trio per collection
// (`<slug>.list`, `<slug>.find`, `<slug>.findOne`), each carrying the real
// per-collection document schema. The runtime builds the group dynamically; the
// public return type is derived from the config (`VoilaRpcs<C>`) so `RpcClient`
// nests it into a fully typed `client.<slug>.list/find/findOne`.

import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import type { NormalizedConfig } from "../config/config";
import type { Collection } from "../config/schema/collection";
import { collectionDocumentSchema } from "./document";
import { BadRequest, InternalError, NotFound } from "./errors";
import { FindOnePayload, FindPayload, ListPayload } from "./schemas";
import type { VoilaRpcs } from "./types";

/** The three read procedures for a single collection. */
const readRpcs = (slug: string, collection: Collection): ReadonlyArray<Rpc.Any> => {
  const doc = collectionDocumentSchema(collection);
  return [
    Rpc.make(`${slug}.list`, {
      payload: ListPayload,
      success: Schema.Struct({
        documents: Schema.Array(doc),
        nextCursor: Schema.NullOr(Schema.String),
      }),
      error: Schema.Union(BadRequest, InternalError),
    }),
    Rpc.make(`${slug}.find`, {
      payload: FindPayload,
      success: doc,
      error: Schema.Union(NotFound, InternalError),
    }),
    Rpc.make(`${slug}.findOne`, {
      payload: FindOnePayload,
      success: Schema.NullOr(doc),
      error: Schema.Union(BadRequest, InternalError),
    }),
  ];
};

/** Build the read-path `RpcGroup`, typed from the config's collections. */
export const makeVoilaRpc = <C extends NormalizedConfig>(
  config: C,
): RpcGroup.RpcGroup<VoilaRpcs<C>> =>
  RpcGroup.make(
    ...Object.entries(config.collections).flatMap(([slug, collection]) =>
      readRpcs(slug, collection),
    ),
    // The group is assembled at runtime from string-keyed config, so its type is
    // re-asserted as the config-derived union — the procedures match it by tag.
  ) as unknown as RpcGroup.RpcGroup<VoilaRpcs<C>>;
