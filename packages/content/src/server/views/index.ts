// Public surface of the saved-views layer: the shared (global) `voila_views`
// store the `_views` REST routes (and a host's own tooling) read and write.

export {
  defaultViewId,
  makeViewStore,
  type NewView,
  type SavedView,
  type ViewConfig,
  type ViewPatch,
  type ViewSort,
  type ViewStore,
  type ViewType,
} from "./store";
