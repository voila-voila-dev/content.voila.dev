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
//
// The handler returns `null` for anything it doesn't own (an unmatched method or
// path) so the host can fall through to its own routes.

import { handleFindByField, handleFindById, handleList, type RestContext } from "./handlers";
import { handleCreate, handleDelete, handleRestore, handleUpdate } from "./write";

export interface RestHandlerOptions {
  /** Path prefix the routes mount under (e.g. `/admin/api`). Defaults to none. */
  readonly basePath?: string;
}

// Trim a trailing slash so `"/admin/api/"` and `"/admin/api"` behave the same;
// an empty/`"/"` base means "mount at the root".
function normalizeBase(basePath: string | undefined): string {
  if (!basePath || basePath === "/") return "";
  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

/**
 * Build a `(request) => Promise<Response | null>` that serves the read routes.
 * Returns `null` when the request isn't a read route this handler owns.
 */
export function createRestHandler(
  ctx: RestContext,
  options: RestHandlerOptions = {},
): (request: Request) => Promise<Response | null> {
  const basePath = normalizeBase(options.basePath);
  return async (request: Request): Promise<Response | null> => {
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
    const [collection, second, third, fourth] = segments;
    if (collection === undefined) return null;
    const { method } = request;

    if (method === "GET") {
      if (segments.length === 1) return handleList(ctx, collection, url);
      if (segments.length === 2 && second !== undefined) {
        return handleFindById(ctx, collection, second);
      }
      if (segments.length === 4 && second === "by" && third !== undefined && fourth !== undefined) {
        return handleFindByField(ctx, collection, third, fourth);
      }
      return null;
    }

    if (method === "POST") {
      if (segments.length === 1) return handleCreate(ctx, collection, request);
      if (segments.length === 3 && second !== undefined && third === "restore") {
        return handleRestore(ctx, collection, second);
      }
      return null;
    }

    if (method === "PATCH" && segments.length === 2 && second !== undefined) {
      return handleUpdate(ctx, collection, second, request);
    }

    if (method === "DELETE" && segments.length === 2 && second !== undefined) {
      return handleDelete(ctx, collection, second);
    }

    return null;
  };
}
