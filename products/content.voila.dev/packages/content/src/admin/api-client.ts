/**
 * Internal `fetch` wrapper used by the admin views to talk to the read REST
 * endpoints. Lives in `@voila/content/internal` until the dedicated
 * `@voila/client` package lands (M1 — separate roadmap item).
 *
 * Every call resolves the typed envelope or throws an `ApiError` whose
 * `code` mirrors the server's error code so callers can branch on
 * `error.code === "NOT_FOUND"` etc.
 */

export type ListResponse<Row = Record<string, unknown>> = {
  data: Row[];
  nextCursor: string | null;
};

export type FindResponse<Row = Record<string, unknown>> = {
  data: Row;
};

export type ErrorEnvelope = {
  error: { code: string; message: string; details?: unknown };
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, envelope: ErrorEnvelope["error"]) {
    super(envelope.message);
    this.name = "ApiError";
    this.status = status;
    this.code = envelope.code;
    this.details = envelope.details;
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let body: ErrorEnvelope;
  try {
    body = (await res.json()) as ErrorEnvelope;
  } catch {
    throw new ApiError(res.status, {
      code: "INTERNAL",
      message: `Request failed with ${res.status}`,
    });
  }
  throw new ApiError(res.status, body.error);
}

export interface ListParams {
  limit?: number;
  cursor?: string | null;
  orderBy?: string;
  order?: "asc" | "desc";
}

function buildListUrl(apiMount: string, collection: string, params: ListParams): string {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.orderBy) search.set("orderBy", params.orderBy);
  if (params.order) search.set("order", params.order);
  const qs = search.toString();
  return `${apiMount}/${encodeURIComponent(collection)}${qs ? `?${qs}` : ""}`;
}

export async function fetchList<Row = Record<string, unknown>>(
  apiMount: string,
  collection: string,
  params: ListParams = {},
  init?: RequestInit,
): Promise<ListResponse<Row>> {
  const res = await fetch(buildListUrl(apiMount, collection, params), init);
  return unwrap<ListResponse<Row>>(res);
}

export async function fetchById<Row = Record<string, unknown>>(
  apiMount: string,
  collection: string,
  id: string,
  init?: RequestInit,
): Promise<FindResponse<Row>> {
  const res = await fetch(
    `${apiMount}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`,
    init,
  );
  return unwrap<FindResponse<Row>>(res);
}

/** Query-key factories. Stable shape so cache hits work across views. */
export const queryKeys = {
  list: (collection: string, params: ListParams = {}) =>
    [
      "voila",
      "list",
      collection,
      {
        limit: params.limit ?? null,
        cursor: params.cursor ?? null,
        orderBy: params.orderBy ?? null,
        order: params.order ?? null,
      },
    ] as const,
  byId: (collection: string, id: string) => ["voila", "byId", collection, id] as const,
};
