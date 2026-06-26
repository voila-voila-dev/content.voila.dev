// The saved-views routes — list / create / update / delete the admin list views,
// over the shared `ViewStore`. Mounted under a reserved `_views` segment of a
// collection (`/:collection/_views`), and only when the host wires a `views`
// context; without one the dispatcher doesn't own the routes.
//
// Views are SHARED across all admin users: any signed-in caller sees and can
// edit the same set (the caller's id is recorded only as the creator, for
// audit). An unauthenticated request is still a 401 — you must be signed in to
// the admin — and writes ride the same CSRF protection as any other mutation.
// Listing seeds the collection's undeletable default Table view on first access.

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

const VIEW_TYPES: ReadonlySet<ViewType> = new Set(["table", "kanban", "map", "calendar"]);

// Views are shared, but you must be signed in to read or change them — the
// caller's id is recorded as the creator. No principal (not signed in) → 401.
function requireCaller(principal: Principal | null): string {
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
    fail(badRequest({ field: "type", expected: [...VIEW_TYPES].join(" | ") }));
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

/** `GET /:collection/_views` — the collection's shared views (seeds the default). */
export function handleViewsList(
  views: ViewsContext,
  collection: string,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    const caller = requireCaller(principal);
    await views.store.ensureDefault(collection, caller);
    const data = await views.store.list(collection);
    return Response.json({ data });
  }, views.onError);
}

/** `POST /:collection/_views` — save a new shared view (201). */
export function handleViewsCreate(
  views: ViewsContext,
  collection: string,
  request: Request,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    const caller = requireCaller(principal);
    const view = parseNewView(await readBody(request));
    const created = await views.store.create(collection, view, caller);
    return Response.json({ data: created }, { status: 201 });
  }, views.onError);
}

/** `PATCH /:collection/_views/:id` — update a shared view. */
export function handleViewsUpdate(
  views: ViewsContext,
  collection: string,
  id: string,
  request: Request,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    requireCaller(principal);
    const patch = parseViewPatch(await readBody(request));
    const updated = await views.store.update(collection, id, patch);
    if (updated === null) fail(notFound(VIEWS_SEGMENT));
    return Response.json({ data: updated });
  }, views.onError);
}

/** `DELETE /:collection/_views/:id` — delete a shared view (the seeded default
 *  is undeletable; the store treats that as a no-op). */
export function handleViewsDelete(
  views: ViewsContext,
  collection: string,
  id: string,
  principal: Principal | null,
): Promise<Response> {
  return runHandler(async () => {
    requireCaller(principal);
    await views.store.delete(collection, id);
    return Response.json({ data: { id } });
  }, views.onError);
}
