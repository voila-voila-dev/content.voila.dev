// `@voila/content/client` — the typed REST client inferred from a config. Pair
// `makeClient(config, { baseUrl })` with the server's `createRestHandler`
// dispatcher to call list/find/create/update/delete/restore with full
// per-collection typing and a shared error vocabulary.

export {
  type ClientOptions,
  type CollectionClient,
  type ContentClient,
  type DraftFilter,
  type DraftSystemFields,
  type ListPage,
  type ListParams,
  type LookupValue,
  makeClient,
  type OrderKey,
  type Revision,
  type RevisionListParams,
  type RevisionPage,
  type Stored,
  type SystemFields,
} from "./client";
export { type ApiFailure, ContentClientError, isContentClientError } from "./errors";
export {
  type MediaClient,
  type MediaItem,
  type MediaListPage,
  type MediaListParams,
  type MediaUploadOpts,
  makeMediaClient,
} from "./media";
