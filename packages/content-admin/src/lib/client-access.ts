// The typed `ContentClient<C>` is keyed by literal collection slug, but the
// generic screens index it by a runtime `params.collection` string. This narrows
// that dynamic access to the subset of methods the CRUD screens call — the only
// place the precise per-collection typing is traded for a runtime lookup.

import type { NormalizedConfig } from "@voila/content";
import type { ContentClient } from "@voila/content/client";
import type { Doc } from "@voila/content-ui";

export interface ListPageLike {
  readonly data: ReadonlyArray<Doc>;
  readonly nextCursor?: string | null;
}

/** The CRUD surface the generic screens use, erased of per-collection typing. */
export interface AnyCollectionClient {
  list(params?: { cursor?: string }): Promise<ListPageLike>;
  find(id: string): Promise<Doc | null>;
  create(data: Doc): Promise<Doc>;
  update(id: string, data: Doc): Promise<Doc>;
  delete(id: string): Promise<void>;
}

/** Resolve the per-collection client for a runtime slug. The precise
 *  per-collection typing is irrelevant once we index by a runtime string. */
export function collectionClient(
  client: ContentClient<NormalizedConfig>,
  slug: string,
): AnyCollectionClient {
  return (client as unknown as Record<string, AnyCollectionClient>)[slug] as AnyCollectionClient;
}

/** The singleton surface the singleton screen uses, erased of typing. */
export interface AnySingletonClient {
  get(): Promise<Doc | null>;
  set(data: Doc): Promise<Doc>;
}

/** Resolve the per-singleton client for a runtime slug. */
export function singletonClient(
  client: ContentClient<NormalizedConfig>,
  slug: string,
): AnySingletonClient {
  return (client as unknown as Record<string, AnySingletonClient>)[slug] as AnySingletonClient;
}
