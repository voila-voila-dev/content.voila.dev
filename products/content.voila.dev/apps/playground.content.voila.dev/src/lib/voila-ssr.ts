// VENDED by @voila/content-registry — you own this file.
// Server-only SSR prefetch. For the initial (server-rendered) request we re-issue
// the collection read *server-side* with the visitor's session cookie forwarded,
// then dehydrate the effect-atom registry. The matching browser atom hydrates from
// that payload on mount — so the list/detail views paint with data and never fire a
// second fetch (no waterfall). The deterministic atom keys set by `makeVoilaAtoms`
// are what let the server registry and the browser registry line up by key.
//
// These are TanStack `createServerFn`s: the handler bodies run only on the server
// (in-process during SSR, so no extra hop) and are stripped from the client bundle.
import { FetchHttpClient, HttpClient, HttpClientRequest } from "@effect/platform";
import { type Atom, Hydration, Registry, Result } from "@effect-atom/atom";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";
import { makeVoilaAtoms } from "@voila/content/client/atoms";
import { Effect, Layer } from "effect";
import config from "~/content.config";
import type { AnyCollectionAtoms } from "~/lib/admin";

/** A dehydrated atom payload — JSON-safe, embedded in the SSR response. */
export type DehydratedAtoms = ReturnType<typeof Hydration.toValues>;

// A `FetchHttpClient` that re-attaches the visitor's `Cookie` to the in-worker RPC
// call, so the session-enforced read authorises as that user.
const cookieClient = (cookie: string): Layer.Layer<HttpClient.HttpClient> =>
  Layer.effect(
    HttpClient.HttpClient,
    Effect.map(
      HttpClient.HttpClient,
      HttpClient.mapRequest(HttpClientRequest.setHeader("cookie", cookie)),
    ),
  ).pipe(Layer.provide(FetchHttpClient.layer));

// The current request's session cookie + origin, or `null` when unauthenticated
// (no cookie → nothing worth prefetching; the client guard redirects to /login).
const requestContext = (): { origin: string; cookie: string } | null => {
  const cookie = getRequestHeader("cookie");
  if (!cookie) return null;
  return { origin: getRequestUrl().origin, cookie };
};

// Resolve `slug`'s atom set, bound to this request's origin + cookie.
const collectionAtoms = (
  origin: string,
  cookie: string,
  slug: string,
): AnyCollectionAtoms | undefined => {
  const atoms = makeVoilaAtoms(config, {
    url: `${origin}/admin/api/rpc`,
    httpClient: cookieClient(cookie),
  });
  return (atoms.collections as unknown as Record<string, AnyCollectionAtoms>)[slug];
};

// Mount the atom in a throwaway registry, wait until it settles, then dehydrate to
// a JSON string (the server-fn boundary only carries JSON; the loader re-parses).
const dehydrateSettled = async (
  atom: Atom.Atom<Result.Result<unknown, unknown>>,
): Promise<string> => {
  const registry = Registry.make();
  const unmount = registry.mount(atom); // keeps the node alive until we dehydrate
  await new Promise<void>((resolve) => {
    const unsub = registry.subscribe(
      atom,
      (result) => {
        if (Result.isSuccess(result) || Result.isFailure(result)) {
          unsub();
          resolve();
        }
      },
      { immediate: true },
    );
  });
  const dehydrated = Hydration.toValues(Hydration.dehydrate(registry));
  unmount();
  registry.dispose();
  return JSON.stringify(dehydrated);
};

// Server fns carry JSON only, so each returns the dehydrated payload as a string
// (`"[]"` when there's nothing to prefetch); `parseDehydrated` restores it.
const EMPTY = "[]";

/** Parse a server-fn payload back into the dehydrated atoms the boundary hydrates. */
export const parseDehydrated = (payload: string): DehydratedAtoms =>
  JSON.parse(payload) as DehydratedAtoms;

/** Prefetch a collection's first list page (matches `CollectionTable`'s atom input). */
export const prefetchCollectionList = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; limit?: number }) => data)
  .handler(async ({ data }): Promise<string> => {
    const ctx = requestContext();
    if (!ctx) return EMPTY;
    const atoms = collectionAtoms(ctx.origin, ctx.cookie, data.slug);
    if (!atoms) return EMPTY;
    return dehydrateSettled(atoms.list({ limit: data.limit ?? 50 }));
  });

/** Prefetch a single document (matches `CollectionDetail`'s `find` atom input). */
export const prefetchDocument = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string; id: string }) => data)
  .handler(async ({ data }): Promise<string> => {
    const ctx = requestContext();
    if (!ctx) return EMPTY;
    const atoms = collectionAtoms(ctx.origin, ctx.cookie, data.slug);
    if (!atoms) return EMPTY;
    return dehydrateSettled(atoms.find(data.id));
  });
