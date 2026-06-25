// The typed `ContentClient<C>` is keyed by literal collection slug, but the
// generic screens index it by a runtime `params.collection` string. This narrows
// that dynamic access to the subset of methods the CRUD screens call — the only
// place the precise per-collection typing is traded for a runtime lookup.

import type { NormalizedConfig } from "@voila/content";
import type {
  ContentClient,
  ListFilter,
  NewView,
  SavedView,
  ViewPatch,
} from "@voila/content/client";
import type { Doc } from "@voila/content-ui";

export interface ListPageLike {
  readonly data: ReadonlyArray<Doc>;
  readonly nextCursor?: string | null;
}

/** The list params the generic screens pass (sort + server-side filters + cursor). */
export interface AnyListParams {
  readonly cursor?: string;
  readonly limit?: number;
  readonly orderBy?: string;
  readonly order?: "asc" | "desc";
  readonly status?: string;
  readonly filters?: ReadonlyArray<ListFilter>;
}

/** The saved-views sub-API, erased of per-collection typing. */
export interface AnyViewsClient {
  list(): Promise<ReadonlyArray<SavedView>>;
  create(view: NewView): Promise<SavedView>;
  update(id: string, patch: ViewPatch): Promise<SavedView>;
  delete(id: string): Promise<void>;
}

/** The CRUD surface the generic screens use, erased of per-collection typing. */
export interface AnyCollectionClient {
  list(params?: AnyListParams): Promise<ListPageLike>;
  find(id: string): Promise<Doc | null>;
  create(data: Doc): Promise<Doc>;
  update(id: string, data: Doc): Promise<Doc>;
  delete(id: string): Promise<void>;
  readonly views: AnyViewsClient;
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
