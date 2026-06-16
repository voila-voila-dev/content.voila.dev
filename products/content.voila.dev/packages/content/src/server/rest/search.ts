// The full-text search handler over the runtime `Database`. Mirrors the read
// handlers' shape: resolve the collection, parse the query string, call
// `Database.search`, and shape the success envelope; failures travel through the
// `throw` channel as `ApiError` and `runHandler` renders them.
//
// Results are ranked rows (`{ data }` — no cursor; search is a top-N relevance
// query, not a keyset page). Every row goes through `serializeRow`, so read-denied
// fields are redacted and `?locale=` flattens localized fields like any other read.

import type { Principal } from "../auth/principal";
import { DatabaseError } from "../database/database";
import type { SearchOpts } from "../database/types";
import { badRequest, fail } from "./errors";
import {
  type RestContext,
  requireCollection,
  resolveReadLocale,
  runHandler,
  serializeRow,
} from "./handlers";
import { parseLimit, parseStatus } from "./query";

// Translate a search `Database` call's typed failure: a collection that isn't
// search-enabled (or any other `DatabaseError`) becomes a 400, matching how the
// revision/publish handlers treat their non-applicable collections.
async function runSearch<A>(slug: string, fn: () => Promise<A>): Promise<A> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof DatabaseError)
      fail(badRequest({ collection: slug, reason: error.message }));
    throw error;
  }
}

/** `GET /:collection/search?q=…&limit=…&status=…` — ranked full-text results. */
export function handleSearch(
  ctx: RestContext,
  slug: string,
  url: URL,
  principal: Principal | null = null,
): Promise<Response> {
  return runHandler(async () => {
    const entry = requireCollection(ctx.config, slug);
    const query = url.searchParams.get("q") ?? "";
    const opts: SearchOpts = {
      limit: parseLimit(url.searchParams.get("limit")),
      status: parseStatus(url.searchParams.get("status")),
    };
    const chain = resolveReadLocale(ctx.config, url);
    const result = await runSearch(entry.slug, () => ctx.database.search(entry.slug, query, opts));
    const data = result.documents.map((row) => serializeRow(entry, row, principal, chain));
    return Response.json({ data });
  }, ctx.onError);
}
