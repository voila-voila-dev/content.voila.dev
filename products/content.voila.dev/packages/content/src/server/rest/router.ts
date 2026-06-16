// A minimal request dispatcher for the REST routes — enough to serve the API
// from a single `fetch` handler (worker entry, tests) without a router
// dependency. A host that prefers one route file per endpoint can skip this and
// call the `handle*` functions directly (the route shapes are documented below).
//
// Routes (under an optional `basePath`):
//   GET    /:collection                    → list
//   GET    /:collection/search             → full-text search (`?q=`, `?limit=`, `?status=`)
//   GET    /:collection/:id                → find by id
//   GET    /:collection/by/:field/:value   → find by unique field
//   POST   /:collection                    → create
//   PATCH  /:collection/:id                → update
//   DELETE /:collection/:id                → soft-delete
//   POST   /:collection/:id/restore        → restore
//   POST   /:collection/:id/publish        → publish (optional `{ at }`)
//   POST   /:collection/:id/unpublish      → unpublish
//   GET    /:collection/:id/revisions      → list version history (newest first)
//   GET    /:collection/:id/revisions/:rev → fetch one revision
//   POST   /:collection/:id/revisions/:rev/restore → re-apply a revision
//
// Singleton routes (a slug defined via `defineSingleton` swaps the root pair):
//   GET    /:singleton   → the one document (`{ data: {…} }`, 404 until first set)
//   PUT    /:singleton   → upsert from a full `{ data }` payload (`id = slug`)
//   POST   /:singleton   → same upsert (alias)
// Both writes guard as an `update` on the singleton's one document.
//
// Media routes (reserved `_media` segment; served only when `ctx.media` is wired):
//   POST   /_media           → upload (multipart: file + alt?/width?/height?)
//   GET    /_media           → list the library (newest first)
//   GET    /_media/:id       → fetch one record (metadata)
//   GET    /_media/:id/file  → the bytes (302 to a signed URL when available)
//   DELETE /_media/:id       → delete bytes + record
//
// Dispatch is a data-driven route table: each row pairs an HTTP method and a
// path pattern (`:name` captures a segment, anything else matches literally)
// with the guard descriptor (operation + collection + optional document id)
// and the handler a hit maps to. Rows are tried in order, first match wins —
// so two rows sharing a pattern (singleton vs collection root) put the more
// specific `when` predicate first. The guard (`authorizeRequest`) runs between
// match and invoke: an unmatched route returns `null` *before* the guard, so
// the host can fall through to its own routes without tripping auth; a matched
// route that fails auth/CSRF/RBAC returns the typed error envelope.

import { authorizeRequest, type GuardOptions, type RouteDescriptor } from "../auth/guard";
import type { Operation, Principal } from "../auth/principal";
import {
  handleFindByField,
  handleFindById,
  handleGetSingleton,
  handleList,
  isSingleton,
  type RestContext,
  type RestErrorHook,
} from "./handlers";
import {
  handleMediaDelete,
  handleMediaFile,
  handleMediaGet,
  handleMediaList,
  handleMediaUpload,
  MEDIA_SEGMENT,
  type MediaContext,
} from "./media";
import { handleGetRevision, handleListRevisions, handleRestoreRevision } from "./revisions";
import { handleSearch } from "./search";
import {
  handleCreate,
  handleDelete,
  handlePublish,
  handleRestore,
  handleSetSingleton,
  handleUnpublish,
  handleUpdate,
} from "./write";

export interface RestHandlerOptions extends GuardOptions {
  /** Path prefix the routes mount under (e.g. `/admin/api`). Defaults to none. */
  readonly basePath?: string;
  /**
   * Observes unexpected errors (driver failures, programming bugs) before they
   * fold to a 500 `INTERNAL` envelope. Without one (here or on the contexts),
   * causes are logged via `console.error` outside production.
   */
  readonly onError?: RestErrorHook;
}

// A matched route: what to authorize against, and how to run it. The thunk
// receives the principal the guard resolved so handlers can evaluate the
// per-field access rules (`field.meta.access`).
interface MatchedRoute {
  readonly route: RouteDescriptor;
  readonly run: (principal: Principal | null) => Promise<Response>;
}

// The request being routed, as the table's predicates and handlers see it.
interface RouteRequest {
  readonly ctx: RestContext;
  readonly request: Request;
  readonly url: URL;
  readonly basePath: string;
}

// The media table additionally sees the wired media context — the dispatcher
// only scans that table once `ctx.media` is known to be present, so its
// handlers don't re-narrow an optional.
interface MediaRouteRequest extends RouteRequest {
  readonly media: MediaContext;
}

// Param names captured by a pattern, derived from the literal: ":collection/:id"
// yields "collection" | "id". Keying the params object off the pattern (instead
// of an index signature) keeps `params.id` a plain `string` in handlers — no
// `noUncheckedIndexedAccess` widening, and a typo'd name is a type error.
type ParamNames<P extends string> = P extends `${infer Head}/${infer Tail}`
  ? ParamNames<Head> | ParamNames<Tail>
  : P extends `:${infer Name}`
    ? Name
    : never;

type Params<P extends string> = { readonly [K in ParamNames<P>]: string };

// One row of the route table. The guard's `collection` comes from the
// `:collection` capture when the pattern has one; a pattern without it (the
// literal `_media` routes) must name its pseudo-collection explicitly — the
// conditional makes forgetting either a type error.
type RouteOptions<P extends string, M> = {
  readonly operation: Operation;
  /** Capture naming the document the guard authorizes against, if any. */
  readonly documentId?: ParamNames<P>;
  /** Extra predicate beyond the pattern (e.g. the slug is a singleton). */
  readonly when?: (m: M, params: Params<P>) => boolean;
  readonly run: (m: M, params: Params<P>, principal: Principal | null) => Promise<Response>;
} & ("collection" extends ParamNames<P>
  ? { readonly collection?: undefined }
  : { readonly collection: string });

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// A compiled row: resolves a request to a `MatchedRoute`, or `null` when the
// method, shape, or `when` predicate doesn't fit.
type RouteMatcher<M> = (
  m: M,
  method: string,
  segments: ReadonlyArray<string>,
) => MatchedRoute | null;

// Builds the row definer for a table whose rows see `M`. Compiling the pattern
// here (once, at module load) keeps the per-request work to a segment walk.
function routeTable<M>() {
  return function defineRoute<P extends string>(
    method: Method,
    pattern: P,
    options: RouteOptions<P, M>,
  ): RouteMatcher<M> {
    const patternSegments = pattern.split("/");
    return (m, requestMethod, segments) => {
      if (requestMethod !== method) return null;
      if (segments.length !== patternSegments.length) return null;
      const captured: Record<string, string> = {};
      for (let i = 0; i < patternSegments.length; i += 1) {
        const expected = patternSegments[i];
        const actual = segments[i];
        if (expected === undefined || actual === undefined) return null;
        if (expected.startsWith(":")) captured[expected.slice(1)] = actual;
        else if (expected !== actual) return null;
      }
      const params = captured as Params<P>;
      if (options.when !== undefined && !options.when(m, params)) return null;
      // `RouteOptions` guarantees exactly one source for the collection: the
      // `:collection` capture, or the explicit literal when there isn't one.
      const collection = (options.collection ?? captured.collection) as string;
      const documentId =
        options.documentId === undefined ? undefined : captured[options.documentId];
      return {
        route: { operation: options.operation, collection, documentId },
        run: (principal) => options.run(m, params, principal),
      };
    };
  };
}

function matchTable<M>(
  table: ReadonlyArray<RouteMatcher<M>>,
  m: M,
  method: string,
  segments: ReadonlyArray<string>,
): MatchedRoute | null {
  for (const matcher of table) {
    const matched = matcher(m, method, segments);
    if (matched !== null) return matched;
  }
  return null;
}

const content = routeTable<RouteRequest>();

function singleton(m: RouteRequest, params: { readonly collection: string }): boolean {
  return isSingleton(m.ctx.config, params.collection);
}

// The collection routes. A singleton slug swaps the root pair — GET is the one
// document (object envelope), POST/PUT upsert it — so the singleton rows sit
// above the collection rows they share a pattern with. The id-addressed rows
// below still work for singletons (the one row's id is the slug) since the
// namespaces are flat.
const CONTENT_ROUTES: ReadonlyArray<RouteMatcher<RouteRequest>> = [
  content("GET", ":collection", {
    operation: "read",
    documentId: "collection",
    when: singleton,
    run: (m, { collection }, p) => handleGetSingleton(m.ctx, collection, m.url, p),
  }),
  content("GET", ":collection", {
    operation: "list",
    run: (m, { collection }, p) => handleList(m.ctx, collection, m.url, p),
  }),
  // `/:collection/search` is a `read` over the collection (the RBAC hook sees no
  // document id). It sits above the `/:collection/:id` row so the literal
  // `search` segment wins — a document id never equals `search` (ids are UUIDs).
  content("GET", ":collection/search", {
    operation: "read",
    run: (m, { collection }, p) => handleSearch(m.ctx, collection, m.url, p),
  }),
  content("GET", ":collection/:id", {
    operation: "read",
    documentId: "id",
    run: (m, { collection, id }, p) => handleFindById(m.ctx, collection, id, p, m.url),
  }),
  content("GET", ":collection/by/:field/:value", {
    operation: "read",
    run: (m, { collection, field, value }, p) =>
      handleFindByField(m.ctx, collection, field, value, p, m.url),
  }),
  // Version history is a read of the document it belongs to, so the RBAC hook
  // sees the same `read` operation as a direct fetch.
  content("GET", ":collection/:id/revisions", {
    operation: "read",
    documentId: "id",
    run: (m, { collection, id }, p) => handleListRevisions(m.ctx, collection, id, m.url, p),
  }),
  content("GET", ":collection/:id/revisions/:rev", {
    operation: "read",
    documentId: "id",
    run: (m, { collection, id, rev }, p) => handleGetRevision(m.ctx, collection, id, rev, p),
  }),
  content("PUT", ":collection", {
    operation: "update",
    documentId: "collection",
    when: singleton,
    run: (m, { collection }, p) => handleSetSingleton(m.ctx, collection, m.request, p),
  }),
  content("POST", ":collection", {
    operation: "update",
    documentId: "collection",
    when: singleton,
    run: (m, { collection }, p) => handleSetSingleton(m.ctx, collection, m.request, p),
  }),
  content("POST", ":collection", {
    operation: "create",
    run: (m, { collection }, p) => handleCreate(m.ctx, collection, m.request, p),
  }),
  content("POST", ":collection/:id/restore", {
    operation: "restore",
    documentId: "id",
    run: (m, { collection, id }, p) => handleRestore(m.ctx, collection, id, p),
  }),
  content("POST", ":collection/:id/publish", {
    operation: "publish",
    documentId: "id",
    run: (m, { collection, id }, p) => handlePublish(m.ctx, collection, id, m.request, p),
  }),
  content("POST", ":collection/:id/unpublish", {
    operation: "publish",
    documentId: "id",
    run: (m, { collection, id }, p) => handleUnpublish(m.ctx, collection, id, p),
  }),
  // Restoring a revision rewrites the document's content, so it authorizes
  // (and CSRF-checks) as an `update`, not as the soft-delete `restore`.
  content("POST", ":collection/:id/revisions/:rev/restore", {
    operation: "update",
    documentId: "id",
    run: (m, { collection, id, rev }, p) => handleRestoreRevision(m.ctx, collection, id, rev, p),
  }),
  content("PATCH", ":collection/:id", {
    operation: "update",
    documentId: "id",
    run: (m, { collection, id }, p) => handleUpdate(m.ctx, collection, id, m.request, p),
  }),
  content("DELETE", ":collection/:id", {
    operation: "delete",
    documentId: "id",
    run: (m, { collection, id }) => handleDelete(m.ctx, collection, id),
  }),
];

const media = routeTable<MediaRouteRequest>();

// The `_media` sub-table. Reads classify as `list`/`read`, the upload as
// `create`, the delete as `delete` — all on the pseudo-collection `_media`, so
// the host's RBAC hook (and CSRF on the mutations) covers media like any other
// collection. The file route is a `read`: it serves bytes (or a signed
// redirect), but it's still just a read of the document's content.
const MEDIA_ROUTES: ReadonlyArray<RouteMatcher<MediaRouteRequest>> = [
  media("GET", "_media", {
    operation: "list",
    collection: MEDIA_SEGMENT,
    run: (m) => handleMediaList(m.media, m.url, m.basePath),
  }),
  media("GET", "_media/:id", {
    operation: "read",
    collection: MEDIA_SEGMENT,
    documentId: "id",
    run: (m, { id }) => handleMediaGet(m.media, id, m.basePath),
  }),
  media("GET", "_media/:id/file", {
    operation: "read",
    collection: MEDIA_SEGMENT,
    documentId: "id",
    run: (m, { id }) => handleMediaFile(m.media, id),
  }),
  media("POST", "_media", {
    operation: "create",
    collection: MEDIA_SEGMENT,
    run: (m) => handleMediaUpload(m.media, m.request, m.basePath),
  }),
  media("DELETE", "_media/:id", {
    operation: "delete",
    collection: MEDIA_SEGMENT,
    documentId: "id",
    run: (m, { id }) => handleMediaDelete(m.media, id),
  }),
];

// Thread a mount-time `onError` into the handler contexts. A hook the host
// already set on `ctx`/`ctx.media` wins — it's the more specific wiring.
function withErrorHook(ctx: RestContext, onError: RestErrorHook | undefined): RestContext {
  if (onError === undefined) return ctx;
  return {
    onError,
    ...ctx,
    ...(ctx.media === undefined ? {} : { media: { onError, ...ctx.media } }),
  };
}

// Trim a trailing slash so `"/admin/api/"` and `"/admin/api"` behave the same;
// an empty/`"/"` base means "mount at the root".
function normalizeBase(basePath: string | undefined): string {
  if (!basePath || basePath === "/") return "";
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

// Resolve a request to the route it hits, or `null` when this dispatcher doesn't
// own it (wrong base, unknown method/shape). Pure routing — no I/O — so the guard
// can run against the descriptor before any handler executes.
function matchRoute(ctx: RestContext, request: Request, basePath: string): MatchedRoute | null {
  const url = new URL(request.url);
  if (basePath && !url.pathname.startsWith(basePath)) return null;

  // Split first, then decode each segment — so a `%2F` inside a value can't
  // forge an extra path segment.
  const segments = url.pathname
    .slice(basePath.length)
    .split("/")
    .filter((s) => s.length > 0)
    .map(decodeURIComponent);
  if (segments.length === 0) return null;

  const m: RouteRequest = { ctx, request, url, basePath };

  // `_media` is a reserved segment, never a collection slug. The routes exist
  // only when the host wired a media context; otherwise fall through.
  if (segments[0] === MEDIA_SEGMENT) {
    if (ctx.media === undefined) return null;
    return matchTable(MEDIA_ROUTES, { ...m, media: ctx.media }, request.method, segments);
  }

  return matchTable(CONTENT_ROUTES, m, request.method, segments);
}

/**
 * Build a `(request) => Promise<Response | null>` that serves the REST routes.
 * Returns `null` when the request isn't a route this dispatcher owns; otherwise
 * runs the auth/CSRF/RBAC guard, then the matched handler.
 */
export function createRestHandler(
  ctx: RestContext,
  options: RestHandlerOptions = {},
): (request: Request) => Promise<Response | null> {
  const basePath = normalizeBase(options.basePath);
  const handlerCtx = withErrorHook(ctx, options.onError);
  return async (request: Request): Promise<Response | null> => {
    const matched = matchRoute(handlerCtx, request, basePath);
    if (matched === null) return null;
    const verdict = await authorizeRequest(request, matched.route, options);
    if (verdict instanceof Response) return verdict;
    return matched.run(verdict.principal);
  };
}
