# ADR 0001 — Rpc→HttpApi: parallel surface, not derivation

- **Status:** Accepted
- **Date:** 2026-05-30
- **Milestone:** M1 (read path)
- **Context docs:** [roadmap-effect.md](../roadmap-effect.md) (M1 §Engine),
  [effect-architecture-canon.md](../effect-architecture-canon.md)

## Context

M1 ships the read path as an `@effect/rpc` `RpcGroup` (`voilaRpc`) — the
primary, fully-typed surface the admin UI consumes through a derived
`RpcClient`. The roadmap also calls for a REST `HttpApi` (`@effect/platform`)
covering the same reads, because:

- the documented public contract is REST (`{ data }` / `{ error: { code } }`),
- OpenAPI generation needs an `HttpApi` to read from,
- M6 derives the MCP tool surface from procedure metadata, and
- `--eject-server` (M7) wants a transport that isn't RPC-framing-specific.

The roadmap task was a **spike**: *attempt first-class Rpc→HttpApi derivation;
if envelope / pagination / middleware semantics don't carry, ship a thin
parallel `HttpApi` reusing the same `Schema`s and handler `Effect`s.*

## Decision

**Ship a thin parallel `HttpApi`, not a derivation.** `@effect/rpc@0.75.1`
exposes no Rpc→HttpApi derivation helper — `RpcServer` uses
`@effect/platform/HttpApp` only as a *transport* for streaming RPC, and nothing
in the module maps an `RpcGroup` to `HttpApi`/`HttpApiEndpoint`/OpenAPI. A
hand-rolled derivation would have to introspect the group, synthesize endpoints,
and split the single RPC payload into REST path/query/body — bespoke machinery
with no upstream support.

Crucially, the two surfaces are kept from diverging not by deriving one from the
other but by **sharing the read core**:

- `server/read-core.ts` — `makeReadCore(config)` holds the only copy of
  list/find/findOne (pagination, `DatabaseError`→typed-error mapping, decoding
  rows through the per-collection document schema). Both the RPC handlers
  (`server/handlers.ts`) and the HttpApi handlers (`server/httpapi.ts`) delegate
  to it.
- The **document, payload, and error schemas** are imported verbatim by both
  (`server/document.ts`, `server/schemas.ts`, `server/errors.ts`).
- The error **envelope** is one function (`server/envelope.ts`
  `toErrorEnvelope`): RPC surfaces the typed `TaggedError`; REST maps it through
  the same function to `{ error: { code, ... } }` with a stable HTTP status
  (NOT_FOUND→404, BAD_REQUEST→400, INTERNAL→500, UNAUTHORIZED→401).
- **Session enforcement** reuses `Auth.requireSession`: the RPC
  `SessionMiddleware` (`RpcMiddleware`) and the REST `HttpSessionMiddleware`
  (`HttpApiMiddleware`) are thin twins over the same `Auth` service.

A parity test (`server/httpapi.test.ts`) serves both transports over one
SQLite file and asserts equal documents per procedure, the 404 envelope equals
`toErrorEnvelope` of the RPC error, and the OpenAPI export round-trips.

## Consequences

- **Two transports, one implementation.** New read behavior is added once in the
  read core; both surfaces inherit it.
- **Dynamic typing seam.** Like `makeVoilaRpc`, the `HttpApi` is built at runtime
  from string-keyed config, so its construction is `any`-cast (`makeVoilaHttpApi`).
  The RPC client stays fully typed from the config; the REST surface is typed at
  the schema/handler level but its assembled `HttpApi` type is erased. This is an
  accepted, localized cast — the parity test guards runtime correctness.
- **Two minor REST-only divergences**, documented in `httpapi.ts`:
  - URL params must be string-encodeable, so `findOne`'s `value` is a string on
    REST (compared as text), whereas RPC keeps `string | number | boolean`.
  - `limit` parses from a string (`NumberFromString`).
- **OpenAPI / MCP unblocked.** `voilaOpenApi(config)` = `OpenApi.fromApi(...)`;
  M6 can derive MCP tools from the same `HttpApi`.
- **Revisit if** upstream `@effect/rpc` adds first-class HttpApi derivation, or
  the two surfaces' divergences grow — at which point a generator over the shared
  schema metadata may beat maintaining the parallel endpoint definitions.
