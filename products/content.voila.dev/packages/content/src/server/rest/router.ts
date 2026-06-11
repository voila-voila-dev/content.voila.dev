// A minimal request dispatcher for the REST routes — enough to serve the API
// from a single `fetch` handler (worker entry, tests) without a router
// dependency. A host that prefers one route file per endpoint can skip this and
// call the `handle*` functions directly (the route shapes are documented below).
//
// Routes (under an optional `basePath`):
//   GET    /:collection                    → list
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
// Each request is matched to a route descriptor (operation + collection +
// optional document id) and a handler thunk. The guard (`authorizeRequest`) runs
// between match and invoke: an unmatched route returns `null` *before* the guard,
// so the host can fall through to its own routes without tripping auth; a matched
// route that fails auth/CSRF/RBAC returns the typed error envelope.

import { authorizeRequest, type GuardOptions, type RouteDescriptor } from "../auth/guard";
import type { Operation, Principal } from "../auth/principal";
import { handleFindByField, handleFindById, handleList, type RestContext } from "./handlers";
import { handleGetRevision, handleListRevisions, handleRestoreRevision } from "./revisions";
import {
  handleCreate,
  handleDelete,
  handlePublish,
  handleRestore,
  handleUnpublish,
  handleUpdate,
} from "./write";

export interface RestHandlerOptions extends GuardOptions {
  /** Path prefix the routes mount under (e.g. `/admin/api`). Defaults to none. */
  readonly basePath?: string;
}

// A matched route: what to authorize against, and how to run it. The thunk
// receives the principal the guard resolved so handlers can evaluate the
// per-field access rules (`field.meta.access`).
interface MatchedRoute {
  readonly route: RouteDescriptor;
  readonly run: (principal: Principal | null) => Promise<Response>;
}

function route(
  operation: Operation,
  collection: string,
  documentId: string | undefined,
  run: (principal: Principal | null) => Promise<Response>,
): MatchedRoute {
  return { route: { operation, collection, documentId }, run };
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

  // Explicit `!== undefined` guards (not just length checks) so the segment
  // reads narrow under `noUncheckedIndexedAccess`.
  const [collection, second, third, fourth, fifth] = segments;
  if (collection === undefined) return null;
  const { method } = request;

  if (method === "GET") {
    if (segments.length === 1) {
      return route("list", collection, undefined, (p) => handleList(ctx, collection, url, p));
    }
    if (segments.length === 2 && second !== undefined) {
      return route("read", collection, second, (p) => handleFindById(ctx, collection, second, p));
    }
    if (segments.length === 4 && second === "by" && third !== undefined && fourth !== undefined) {
      return route("read", collection, undefined, (p) =>
        handleFindByField(ctx, collection, third, fourth, p),
      );
    }
    // Version history is a read of the document it belongs to, so the RBAC
    // hook sees the same `read` operation as a direct fetch.
    if (segments.length === 3 && second !== undefined && third === "revisions") {
      return route("read", collection, second, (p) =>
        handleListRevisions(ctx, collection, second, url, p),
      );
    }
    if (
      segments.length === 4 &&
      second !== undefined &&
      third === "revisions" &&
      fourth !== undefined
    ) {
      return route("read", collection, second, (p) =>
        handleGetRevision(ctx, collection, second, fourth, p),
      );
    }
    return null;
  }

  if (method === "POST") {
    if (segments.length === 1) {
      return route("create", collection, undefined, (p) =>
        handleCreate(ctx, collection, request, p),
      );
    }
    if (segments.length === 3 && second !== undefined && third === "restore") {
      return route("restore", collection, second, (p) => handleRestore(ctx, collection, second, p));
    }
    if (segments.length === 3 && second !== undefined && third === "publish") {
      return route("publish", collection, second, (p) =>
        handlePublish(ctx, collection, second, request, p),
      );
    }
    if (segments.length === 3 && second !== undefined && third === "unpublish") {
      return route("publish", collection, second, (p) =>
        handleUnpublish(ctx, collection, second, p),
      );
    }
    // Restoring a revision rewrites the document's content, so it authorizes
    // (and CSRF-checks) as an `update`, not as the soft-delete `restore`.
    if (
      segments.length === 5 &&
      second !== undefined &&
      third === "revisions" &&
      fourth !== undefined &&
      fifth === "restore"
    ) {
      return route("update", collection, second, (p) =>
        handleRestoreRevision(ctx, collection, second, fourth, p),
      );
    }
    return null;
  }

  if (method === "PATCH" && segments.length === 2 && second !== undefined) {
    return route("update", collection, second, (p) =>
      handleUpdate(ctx, collection, second, request, p),
    );
  }

  if (method === "DELETE" && segments.length === 2 && second !== undefined) {
    return route("delete", collection, second, () => handleDelete(ctx, collection, second));
  }

  return null;
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
  return async (request: Request): Promise<Response | null> => {
    const matched = matchRoute(ctx, request, basePath);
    if (matched === null) return null;
    const verdict = await authorizeRequest(request, matched.route, options);
    if (verdict instanceof Response) return verdict;
    return matched.run(verdict.principal);
  };
}
