// `voilaRpc` — the per-collection `RpcGroup`. Each collection gets a read trio
// (`<slug>.list`, `<slug>.find`, `<slug>.findOne`) plus the write quartet
// (`<slug>.create`, `<slug>.update`, `<slug>.delete`, `<slug>.restore`), each
// carrying the real per-collection document schema. The runtime builds the group
// dynamically; the public return type is derived from the config (`VoilaRpcs<C>`) so
// `RpcClient` nests it into a fully typed `client.<slug>.{list,…,create,…}`.
// Write procedures carry `CsrfMiddleware` (double-submit CSRF); the whole group is
// additionally wrapped with `SessionMiddleware` at mount time when auth is present.

import { Rpc, RpcGroup } from "@effect/rpc";
import { Schema } from "effect";
import type { NormalizedConfig } from "../config/config";
import type { Collection } from "../config/schema/collection";
import { CsrfMiddleware } from "./csrf";
import { collectionDocumentSchema } from "./document";
import { BadRequest, ConflictError, InternalError, NotFound, ValidationError } from "./errors";
import {
  CreatePayload,
  DeletePayload,
  FindOnePayload,
  FindPayload,
  ListPayload,
  RestorePayload,
  UpdatePayload,
} from "./schemas";
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

/** Acknowledgement returned by a successful delete (id + whether it was a purge). */
const DeleteAck = Schema.Struct({ id: Schema.String, hard: Schema.Boolean });

/** The four write procedures for a single collection — each CSRF-protected. */
const writeRpcs = (slug: string, collection: Collection): ReadonlyArray<Rpc.Any> => {
  const doc = collectionDocumentSchema(collection);
  return [
    Rpc.make(`${slug}.create`, {
      payload: CreatePayload,
      success: doc,
      error: Schema.Union(ValidationError, ConflictError, InternalError),
    }).middleware(CsrfMiddleware),
    Rpc.make(`${slug}.update`, {
      payload: UpdatePayload,
      success: doc,
      error: Schema.Union(ValidationError, ConflictError, NotFound, InternalError),
    }).middleware(CsrfMiddleware),
    Rpc.make(`${slug}.delete`, {
      payload: DeletePayload,
      success: DeleteAck,
      error: Schema.Union(NotFound, InternalError),
    }).middleware(CsrfMiddleware),
    Rpc.make(`${slug}.restore`, {
      payload: RestorePayload,
      success: doc,
      error: Schema.Union(NotFound, InternalError),
    }).middleware(CsrfMiddleware),
  ];
};

/** Build the `RpcGroup` (reads + writes), typed from the config's collections. */
export const makeVoilaRpc = <C extends NormalizedConfig>(
  config: C,
): RpcGroup.RpcGroup<VoilaRpcs<C>> =>
  RpcGroup.make(
    ...Object.entries(config.collections).flatMap(([slug, collection]) => [
      ...readRpcs(slug, collection),
      ...writeRpcs(slug, collection),
    ]),
    // The group is assembled at runtime from string-keyed config, so its type is
    // re-asserted as the config-derived union — the procedures match it by tag.
  ) as unknown as RpcGroup.RpcGroup<VoilaRpcs<C>>;
