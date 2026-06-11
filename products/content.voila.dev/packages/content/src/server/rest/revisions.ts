// The version-history handlers — list a document's revisions, fetch one,
// restore one — over the runtime `Database`. They mirror the read/write
// handlers' shape: resolve the collection, validate the request, call
// `Database`, and shape the success envelope; failures travel through the
// `throw` channel as `ApiError` and `runHandler` renders them.
//
// A revision is `{ rev, createdAt, doc }` — the full stored row as it stood
// after the write that produced it. Restore re-applies a snapshot's *content*
// fields through the normal update path (so it appends a new revision and can
// surface a `CONFLICT` if a restored unique value now collides); publish state
// is untouched.

import { DatabaseError } from "../database/database";
import type { RevisionListOpts } from "../database/types";
import { badRequest, conflict, fail, invalidCursor, notFound } from "./errors";
import { type RestContext, requireCollection, runHandler } from "./handlers";
import { parseLimit } from "./query";

/** Parse `?limit` and `?cursor` for a revision-history page. The cursor is the
 *  prior page's `nextCursor` — a revision number, so anything non-numeric is
 *  malformed. */
function parseRevisionListQuery(url: URL): RevisionListOpts {
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = url.searchParams.get("cursor") ?? undefined;
  if (cursor !== undefined && !/^[0-9]+$/.test(cursor)) fail(invalidCursor());
  return { limit, cursor };
}

/** Parse a `:rev` URL segment: a positive integer revision number. */
function parseRev(raw: string): number {
  const rev = Number(raw);
  if (!Number.isInteger(rev) || rev < 1) {
    fail(badRequest({ field: "rev", expected: "positive integer", raw }));
  }
  return rev;
}

// Run a revision `Database` call, translating its typed failures: a
// unique-constraint violation (a restored value colliding) becomes `CONFLICT`,
// any other `DatabaseError` (collection not revisions-enabled, driver failure)
// becomes a 400 — matching how the publish handlers treat publish-state errors.
async function runRevisions<A>(slug: string, fn: () => Promise<A>): Promise<A> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DatabaseError) {
      if (error.conflict) fail(conflict(slug, error.field));
      fail(badRequest({ collection: slug, reason: error.message }));
    }
    throw error;
  }
}

/** `GET /:collection/:id/revisions` — page through a document's history, newest first. */
export function handleListRevisions(
  ctx: RestContext,
  slug: string,
  id: string,
  url: URL,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const query = parseRevisionListQuery(url);
    const result = await runRevisions(entry.slug, () =>
      ctx.database.listRevisions(entry.slug, id, query),
    );
    return Response.json({ data: result.revisions, nextCursor: result.nextCursor });
  });
}

/** `GET /:collection/:id/revisions/:rev` — fetch one revision by number. */
export function handleGetRevision(
  ctx: RestContext,
  slug: string,
  id: string,
  rawRev: string,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const rev = parseRev(rawRev);
    const revision = await runRevisions(entry.slug, () =>
      ctx.database.getRevision(entry.slug, id, rev),
    );
    if (revision === null) fail(notFound(entry.slug));
    return Response.json({ data: revision });
  });
}

/** `POST /:collection/:id/revisions/:rev/restore` — re-apply a past revision's
 *  content fields to the live row. Echoes the stored row. */
export function handleRestoreRevision(
  ctx: RestContext,
  slug: string,
  id: string,
  rawRev: string,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const rev = parseRev(rawRev);
    const row = await runRevisions(entry.slug, () =>
      ctx.database.restoreRevision(entry.slug, id, rev),
    );
    if (row === null) fail(notFound(entry.slug));
    return Response.json({ data: row });
  });
}
