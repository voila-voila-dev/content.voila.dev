// The saved-views routes — list / create / update / delete a user's admin list
// views, over the owner-scoped `ViewStore`. Mounted under a reserved `_views`
// segment of a collection (`/:collection/_views`), and only when the host wires
// a `views` context; without one the dispatcher doesn't own the routes.
//
// Views are per-user: the owner is taken ONLY from the guard's resolved
// `principal` (never a request field), so a caller can only ever see or change
// their own views, and an unauthenticated request is a 401. Writes ride the same
// CSRF protection as any other mutation (the router classifies create/update/
// delete as mutating operations).

import type { Principal } from "../auth/principal";
import type { NewView, ViewConfig, ViewPatch, ViewStore, ViewType } from "../views/store";
import { badRequest, fail, notFound, unauthorized } from "./errors";
import { type RestErrorHook, runHandler } from "./handlers";

/** What the views routes need from the host: the owner-scoped store. */
export interface ViewsContext {
  readonly store: ViewStore;
  /** Observes unexpected errors before they fold to `INTERNAL` (see `RestErrorHook`). */
  readonly onError?: RestErrorHook;
}

/** The reserved route segment under a collection (`/:collection/_views`). */
export const VIEWS_SEGMENT = "_views";

const VIEW_TYPES: ReadonlySet<ViewType> = new Set(["table", "kanban", "map"]);

// The owner is the authenticated principal — never a body field. No principal
// (open API / not signed in) → 401, since a view has no owner to attach to.
function requireOwner(principal: Principal | null): string {
  if (principal === null) fail(unauthorized());
  return principal.id;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail(badRequest({ reason: "expected a JSON body" }));
  }
  if (json === null || typeof json !== "object") {
    return fail(badRequest({ reason: "expected a JSON object" }));
  }
  // The typed client wraps the payload as `{ data }`; accept a bare object too.
  const data = (json as { data?: unknown }).data;
  if (data !== undefined && data !== null && typeof data === "object") {
    return data as Record<string, unknown>;
  }
  return json as Record<string, unknown>;
}

function asViewType(value: unknown): ViewType {
  if (typeof value !== "string" || !VIEW_TYPES.has(value as ViewType)) {
    fail(badRequest({ field: "type", expected: "table | kanban | map" }));
  }
  return value as ViewType;
}

function asConfig(value: unknown): ViewConfig {
  if (value === undefined) return {};
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(badRequest({ field: "config", expected: "object" }));
  }
  return value as ViewConfig;
}

function asName(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    fail(badRequest({ field: "name", expected: "non-empty string" }));
  }
  return value.trim();
}

function asBoolean(field: string, value: unknown): boolean {
  if (typeof value !== "boolean") fail(badRequest({ field, expected: "boolean" }));
  return value;
}

function parseNewView(body: Record<string, unknown>): NewView {
  return {
    name: asName(body.name),
    type: asViewType(body.type),
    config: asConfig(body.config),
    ...(body.isDefault === undefined ? {} : { isDefault: asBoolean("isDefault", body.isDefault) }),
  };
}

function parseViewPatch(body: Record<string, unknown>): ViewPatch {
  const patch: {
    name?: string;
    type?: ViewType;
    config?: ViewConfig;
    isDefault?: boolean;
  } = {};
  if (body.name !== undefined) patch.name = asName(body.name);
  if (body.type !== undefined) patch.type = asViewType(body.type);
  if (body.config !== undefined) patch.config = asConfig(body.config);
  if (body.isDefault !== undefined) patch.isDefault = asBoolean("isDefault", body.isDefault);
  return patch;
}

/** `GET /:collection/_views` — the caller's saved views for the collection. */
export function handleViewsList(
  views: ViewsContext,
  collection: string,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    const ownerId = requireOwner(principal);
    const data = await views.store.list(ownerId, collection);
    return Response.json({ data });
  }, views.onError);
}

/** `POST /:collection/_views` — save a new view for the caller (201). */
export function handleViewsCreate(
  views: ViewsContext,
  collection: string,
  request: Request,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    const ownerId = requireOwner(principal);
    const view = parseNewView(await readBody(request));
    const created = await views.store.create(ownerId, collection, view);
    return Response.json({ data: created }, { status: 201 });
  }, views.onError);
}

/** `PATCH /:collection/_views/:id` — update one of the caller's views. */
export function handleViewsUpdate(
  views: ViewsContext,
  collection: string,
  id: string,
  request: Request,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    const ownerId = requireOwner(principal);
    const patch = parseViewPatch(await readBody(request));
    const updated = await views.store.update(ownerId, collection, id, patch);
    if (updated === null) fail(notFound(VIEWS_SEGMENT));
    return Response.json({ data: updated });
  }, views.onError);
}

/** `DELETE /:collection/_views/:id` — delete one of the caller's views. */
export function handleViewsDelete(
  views: ViewsContext,
  collection: string,
  id: string,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    const ownerId = requireOwner(principal);
    await views.store.delete(ownerId, collection, id);
    return Response.json({ data: { id } });
  }, views.onError);
}
