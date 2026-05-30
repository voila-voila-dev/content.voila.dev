// VENDED by @voila/content-registry — you own this file.
// Small runtime helpers bridging the dynamic route param (a `string` slug) to the
// statically-typed atom set, plus failure formatting for the views.
import type { Atom, Result } from "@effect-atom/atom";
import config from "~/content.config";
import { collections } from "~/lib/voila-atoms";

export type AnyDoc = Record<string, unknown> & { readonly id: string };

/** The atom shape a view needs, erased of the per-collection document type. */
export interface AnyCollectionAtoms {
  readonly list: (input?: {
    readonly limit?: number;
    readonly cursor?: string;
  }) => Atom.Atom<
    Result.Result<
      { readonly documents: ReadonlyArray<AnyDoc>; readonly nextCursor: string | null },
      unknown
    >
  >;
  readonly find: (id: string) => Atom.Atom<Result.Result<AnyDoc, unknown>>;
}

/** Whether `slug` names a configured collection. */
export const isCollection = (slug: string): boolean => slug in config.collections;

/** The atom set for a slug (the caller must have checked `isCollection`). */
export const atomsFor = (slug: string): AnyCollectionAtoms | undefined =>
  (collections as unknown as Record<string, AnyCollectionAtoms>)[slug];

/** Field keys for a slug, in declaration order. */
export const fieldKeysFor = (slug: string): ReadonlyArray<string> => {
  const collection = config.collections[slug as keyof typeof config.collections];
  return collection ? Object.keys(collection.fields) : [];
};

/** Turn a read failure into a user-facing message + whether it's an auth issue. */
export const describeFailure = (error: unknown): { message: string; unauthorized: boolean } => {
  const tag =
    typeof error === "object" && error !== null && "_tag" in error
      ? String((error as { _tag: unknown })._tag)
      : undefined;
  if (tag === "Unauthorized") return { message: "Your session has expired.", unauthorized: true };
  if (tag === "NotFound") return { message: "Not found.", unauthorized: false };
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "Request failed.";
  // A transport error against a session-enforced endpoint is most likely a 401.
  return { message, unauthorized: tag === "RpcClientError" };
};
