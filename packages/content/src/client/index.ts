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
  type Fetch,
  type FilterOp,
  type ListFilter,
  type ListPage,
  type ListParams,
  type LocaleOption,
  type LookupValue,
  makeClient,
  type NewView,
  type OrderKey,
  type Revision,
  type RevisionListParams,
  type RevisionPage,
  type SavedView,
  type SingletonClient,
  type Stored,
  type SystemFields,
  type ViewConfig,
  type ViewPatch,
  type ViewSort,
  type ViewsClient,
  type ViewType,
} from "./client";
export {
  type ApiFailure,
  ContentClientError,
  isContentClientError,
  issuesByField,
  type ValidationIssue,
} from "./errors";
export {
  type MediaClient,
  type MediaItem,
  type MediaListPage,
  type MediaListParams,
  type MediaUploadOpts,
  makeMediaClient,
} from "./media";
