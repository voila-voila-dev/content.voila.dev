// The parallel REST surface for the read path. `@effect/rpc@0.75.1` ships no
// first-class Rpc→HttpApi derivation (see `docs/pivot/adr/0001-rpc-to-httpapi.md`),
// so this is a thin parallel `HttpApi` that reuses the *same* schemas and the
// *same* read core (`./read-core`) as the RPC group — the two transports never
// diverge on read semantics. This api is also the source the OpenAPI export and
// (M6) the MCP tool surface are generated from.
//
// Per collection, three GET endpoints under a `/{slug}` group:
//   GET /{slug}            → list   (?limit/cursor/orderBy/direction)
//   GET /{slug}/find-one   → findOne (?field & ?value)   [static, declared first]
//   GET /{slug}/{id}       → find    (by primary key)
// Errors are encoded as the documented envelope `{ error: { code, ... } }` with a
// stable HTTP status (NOT_FOUND→404, BAD_REQUEST→400, INTERNAL→500, UNAUTHORIZED→401).

import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpServerRequest,
  OpenApi,
} from "@effect/platform";
import { Effect, Layer, Schema } from "effect";
import { Auth, type AuthService, CurrentSession } from "../auth/auth";
import type { Unauthorized } from "../auth/errors";
import type { NormalizedConfig } from "../config/config";
import type { Collection } from "../config/schema/collection";
import type { Database } from "../sql/database";
import { collectionDocumentSchema } from "./document";
import { toErrorEnvelope } from "./envelope";
import { makeReadCore } from "./read-core";
import { OrderDirection } from "./schemas";

// URL-param representations of the read payloads. Query strings arrive as
// strings, so these must be string-encodeable — `limit` parses from a string and
// `value` is taken verbatim as a string (REST `findOne` compares as text; the
// RPC surface keeps the richer `string | number | boolean`). The document and
// error schemas, by contrast, are shared verbatim with the RPC group.
const ListParams = Schema.Struct({
  limit: Schema.optional(Schema.NumberFromString),
  cursor: Schema.optional(Schema.String),
  orderBy: Schema.optional(Schema.String),
  direction: Schema.optional(OrderDirection),
});

const FindOneParams = Schema.Struct({
  field: Schema.String,
  value: Schema.String,
});

/** The path the REST endpoint is conventionally mounted at (under the host). */
export const VOILA_REST_PATH = "/admin/api/rest";

// --- Error envelopes ---------------------------------------------------------
// Each carries its HTTP status as an `HttpApiSchema` annotation and encodes to
// the documented `{ error: { code, ... } }` body. The `code` literal doubles as
// the discriminant when a handler fails with one of several errors.

const NotFoundError = Schema.Struct({
  error: Schema.Struct({
    code: Schema.Literal("NOT_FOUND"),
    collection: Schema.String,
    id: Schema.String,
  }),
}).annotations(HttpApiSchema.annotations({ status: 404, identifier: "NotFoundError" }));

const BadRequestError = Schema.Struct({
  error: Schema.Struct({ code: Schema.Literal("BAD_REQUEST"), message: Schema.String }),
}).annotations(HttpApiSchema.annotations({ status: 400, identifier: "BadRequestError" }));

const InternalErrorEnvelope = Schema.Struct({
  error: Schema.Struct({ code: Schema.Literal("INTERNAL"), message: Schema.String }),
}).annotations(HttpApiSchema.annotations({ status: 500, identifier: "InternalError" }));

const UnauthorizedError = Schema.Struct({
  error: Schema.Struct({ code: Schema.Literal("UNAUTHORIZED"), message: Schema.String }),
}).annotations(HttpApiSchema.annotations({ status: 401, identifier: "UnauthorizedError" }));

// --- Session middleware ------------------------------------------------------
// Mirrors the RPC `SessionMiddleware` (`../auth/middleware`): reads the request
// cookie, resolves it through `Auth.requireSession`, provides `CurrentSession`,
// and fails with the 401 envelope when no valid session is present.

export class HttpSessionMiddleware extends HttpApiMiddleware.Tag<HttpSessionMiddleware>()(
  "@voila/content-auth/HttpSessionMiddleware",
  { provides: CurrentSession, failure: UnauthorizedError },
) {}

/** Reconstruct a `Request` carrying the wire headers (notably `cookie`). */
const requestFromHeaders = (headers: Record<string, string>): Request =>
  new Request("http://localhost", { headers: new Headers(headers) });

export const HttpSessionMiddlewareLive: Layer.Layer<HttpSessionMiddleware, never, Auth> =
  Layer.effect(
    HttpSessionMiddleware,
    Effect.gen(function* () {
      const auth = yield* Auth;
      return HttpServerRequest.HttpServerRequest.pipe(
        Effect.flatMap((request) => auth.requireSession(requestFromHeaders(request.headers))),
        Effect.catchTag("Unauthorized", (error: Unauthorized) =>
          Effect.fail({ error: { code: "UNAUTHORIZED" as const, message: error.message } }),
        ),
      );
    }),
  );

// --- Api definition ----------------------------------------------------------

/** The three read endpoints for one collection, grouped under `/{slug}`. */
const collectionGroup = (slug: string, collection: Collection) => {
  const doc = collectionDocumentSchema(collection);
  const list = HttpApiEndpoint.get("list", "/")
    .setUrlParams(ListParams)
    .addSuccess(
      Schema.Struct({ documents: Schema.Array(doc), nextCursor: Schema.NullOr(Schema.String) }),
    )
    .addError(BadRequestError)
    .addError(InternalErrorEnvelope);
  // Declared before `find` so the static `/find-one` segment wins over `/:id`.
  const findOne = HttpApiEndpoint.get("findOne", "/find-one")
    .setUrlParams(FindOneParams)
    .addSuccess(Schema.NullOr(doc))
    .addError(BadRequestError)
    .addError(InternalErrorEnvelope);
  const find = HttpApiEndpoint.get("find", "/:id")
    .setPath(Schema.Struct({ id: Schema.String }))
    .addSuccess(doc)
    .addError(NotFoundError)
    .addError(InternalErrorEnvelope);

  return HttpApiGroup.make(slug)
    .add(list)
    .add(findOne)
    .add(find)
    .prefix(`/${slug}` as const);
};

/**
 * Build the read `HttpApi` from the config. When `auth` is set, every group is
 * wrapped with `HttpSessionMiddleware` so reads require a valid session (the
 * same posture as the RPC mount). The base (no-auth) api is what OpenAPI reads.
 */
export const makeVoilaHttpApi = (
  config: NormalizedConfig,
  options?: { readonly auth?: boolean },
) => {
  // The groups are built from string-keyed config, so the chained `.add`/
  // `.middleware` types can't be tracked — the api type is erased at this dynamic
  // seam (the same approach as `makeVoilaRpc`). The return infers `any`.
  // biome-ignore lint/suspicious/noExplicitAny: see above.
  let api: any = HttpApi.make("voila");
  for (const [slug, collection] of Object.entries(config.collections)) {
    api = api.add(collectionGroup(slug, collection));
  }
  if (options?.auth) {
    api = api.middleware(HttpSessionMiddleware);
  }
  return api;
};

/** The OpenAPI 3.1 spec for a config's read api (no auth middleware needed). */
export const voilaOpenApi = (config: NormalizedConfig) =>
  OpenApi.fromApi(makeVoilaHttpApi(config) as Parameters<typeof OpenApi.fromApi>[0]);

// --- Handlers ----------------------------------------------------------------

/** The handler layer for every collection group, requiring a `Database`. */
const makeHandlersLayer = (
  config: NormalizedConfig,
  // biome-ignore lint/suspicious/noExplicitAny: dynamic api (see `makeVoilaHttpApi`).
  api: any,
): Layer.Layer<HttpApi.Api, never, Database> => {
  const core = makeReadCore(config);

  const groupLayer = (slug: string) =>
    // biome-ignore lint/suspicious/noExplicitAny: handler names are config-derived strings.
    HttpApiBuilder.group(api, slug as never, (handlers: any) =>
      handlers
        // The shared core fails with the typed read errors; `toErrorEnvelope`
        // maps them to the documented `{ error: { code, ... } }` body, which the
        // endpoint's declared envelope schemas encode with the right status.
        // biome-ignore lint/suspicious/noExplicitAny: request payloads are validated by the endpoint schemas.
        .handle("list", ({ urlParams }: any) =>
          core.list(slug, urlParams).pipe(Effect.mapError(toErrorEnvelope)),
        )
        // biome-ignore lint/suspicious/noExplicitAny: see above.
        .handle("findOne", ({ urlParams }: any) =>
          core
            .findOne(slug, urlParams.field, urlParams.value)
            .pipe(Effect.mapError(toErrorEnvelope)),
        )
        // biome-ignore lint/suspicious/noExplicitAny: see above.
        .handle("find", ({ path }: any) =>
          core.find(slug, path.id).pipe(Effect.mapError(toErrorEnvelope)),
        ),
    );

  const groups = Object.keys(config.collections).map((slug) => groupLayer(slug));
  const [first, ...rest] = groups;
  // Each group layer provides its `ApiGroup` tag *to* the api layer; the groups'
  // shared `Database` requirement bubbles up as the result's only requirement.
  const apiLayer =
    first === undefined
      ? HttpApiBuilder.api(api)
      : HttpApiBuilder.api(api).pipe(Layer.provide(Layer.mergeAll(first, ...rest)));
  return apiLayer as unknown as Layer.Layer<HttpApi.Api, never, Database>;
};

export interface VoilaHttpApiOptions<LE, AE = never> {
  /** A resolved `Database` layer (no outstanding requirements). */
  readonly database: Layer.Layer<Database, LE, never>;
  /** A resolved `Auth` layer. When provided, reads require a valid session. */
  readonly auth?: Layer.Layer<Auth, AE, never>;
}

/**
 * Build a Web `{ handler, dispose }` for the read `HttpApi` over the given
 * `Database`. The host serves `handler` at `VOILA_REST_PATH`; `dispose` tears
 * the connection down at shutdown. With `auth`, the session middleware is built
 * over the resolved `Auth` layer and enforced on every read.
 */
export const toVoilaHttpApiWebHandler = <LE, AE = never>(
  config: NormalizedConfig,
  options: VoilaHttpApiOptions<LE, AE>,
): {
  readonly handler: (request: Request) => Promise<Response>;
  readonly dispose: () => Promise<void>;
} => {
  const api = makeVoilaHttpApi(config, { auth: options.auth !== undefined });
  const handlers = makeHandlersLayer(config, api).pipe(Layer.provide(options.database));
  const full = options.auth
    ? handlers.pipe(Layer.provide(HttpSessionMiddlewareLive.pipe(Layer.provide(options.auth))))
    : handlers;
  return HttpApiBuilder.toWebHandler(full as Parameters<typeof HttpApiBuilder.toWebHandler>[0]);
};

export type { AuthService };
