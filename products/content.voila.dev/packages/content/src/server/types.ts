// The type-level mirror of the runtime RPC group: `VoilaRpcs<C>` derives the
// exact `Rpc` union from a config's collections, reusing each collection's field
// types via `InferFields`. Because `RpcClient`/`RpcTest` nest dotted tags
// (`posts.list` → `client.posts.list`), a group typed as `RpcGroup<VoilaRpcs<C>>`
// yields a fully typed client — `client.posts.find({ id })` returns
// `Effect<Post, NotFound>` — with no codegen and no hand-written facade.

import type { Rpc } from "@effect/rpc";
import type { Schema } from "effect";
import type { NormalizedConfig } from "../config/config";
import type { Collection } from "../config/schema/collection";
import type { FieldsMap } from "../config/schema/fields";
import type { InferFields } from "../config/schema/infer";
import type { CsrfMiddleware } from "./csrf";
import type { BadRequest, ConflictError, InternalError, NotFound, ValidationError } from "./errors";
import type {
  CreatePayload,
  DeletePayload,
  FindOnePayload,
  FindPayload,
  ListPayload,
  RestorePayload,
  UpdatePayload,
} from "./schemas";

/** System columns every collection row carries (mirrors `document.ts`). */
interface SystemColumns {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/** The decoded document type for a collection's fields. */
export type VoilaDoc<F extends FieldsMap> = SystemColumns & InferFields<F>;

/** The decoded document type for a collection slug in a config. */
export type VoilaDocFor<
  C extends NormalizedConfig,
  Slug extends keyof C["collections"] & string,
> = VoilaDoc<FieldsOf<C["collections"][Slug]>>;

// Success schemas are expressed by their decoded `Type` — that's all `RpcClient`
// reads — which keeps their schema `Context` at `never`.
type DocSchema<F extends FieldsMap> = Schema.Schema<VoilaDoc<F>>;
type ListSuccess<F extends FieldsMap> = Schema.Schema<{
  readonly documents: ReadonlyArray<VoilaDoc<F>>;
  readonly nextCursor: string | null;
}>;
type FindOneSuccess<F extends FieldsMap> = Schema.Schema<VoilaDoc<F> | null>;

type ListError = Schema.Union<[typeof BadRequest, typeof InternalError]>;
type FindError = Schema.Union<[typeof NotFound, typeof InternalError]>;
type FindOneError = Schema.Union<[typeof BadRequest, typeof InternalError]>;

// Write success/error shapes. `data` is `unknown` on the wire (the handler validates
// it into a typed `ValidationError`), so the client input is `{ data }`; the
// *return* is the fully-typed document. The write Rpcs carry `CsrfMiddleware`, which
// surfaces `Forbidden` on the client error channel automatically.
type DeleteAck = Schema.Struct<{ id: typeof Schema.String; hard: typeof Schema.Boolean }>;
type CreateError = Schema.Union<
  [typeof ValidationError, typeof ConflictError, typeof InternalError]
>;
type UpdateError = Schema.Union<
  [typeof ValidationError, typeof ConflictError, typeof NotFound, typeof InternalError]
>;
type DeleteError = Schema.Union<[typeof NotFound, typeof InternalError]>;

type FieldsOf<Col> = Col extends Collection<string, infer F> ? F : never;

/** The read trio + write quartet for one collection, fully typed. */
export type CollectionRpcs<K extends string, F extends FieldsMap> =
  | Rpc.Rpc<`${K}.list`, Schema.Struct<typeof ListPayload>, ListSuccess<F>, ListError>
  | Rpc.Rpc<`${K}.find`, Schema.Struct<typeof FindPayload>, DocSchema<F>, FindError>
  | Rpc.Rpc<`${K}.findOne`, Schema.Struct<typeof FindOnePayload>, FindOneSuccess<F>, FindOneError>
  | Rpc.Rpc<
      `${K}.create`,
      Schema.Struct<typeof CreatePayload>,
      DocSchema<F>,
      CreateError,
      typeof CsrfMiddleware
    >
  | Rpc.Rpc<
      `${K}.update`,
      Schema.Struct<typeof UpdatePayload>,
      DocSchema<F>,
      UpdateError,
      typeof CsrfMiddleware
    >
  | Rpc.Rpc<
      `${K}.delete`,
      Schema.Struct<typeof DeletePayload>,
      DeleteAck,
      DeleteError,
      typeof CsrfMiddleware
    >
  | Rpc.Rpc<
      `${K}.restore`,
      Schema.Struct<typeof RestorePayload>,
      DocSchema<F>,
      DeleteError,
      typeof CsrfMiddleware
    >;

/** The `Rpc` union for every collection in a config — the group's type param. */
export type VoilaRpcs<C extends NormalizedConfig> = {
  [K in keyof C["collections"] & string]: CollectionRpcs<K, FieldsOf<C["collections"][K]>>;
}[keyof C["collections"] & string];
