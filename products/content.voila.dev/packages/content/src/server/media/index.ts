// Public surface of the media layer: the `voila_media` record store the
// `_media` REST routes (and a host's own tooling) read and write.

export {
  type MediaListOpts,
  type MediaListResult,
  type MediaRecord,
  type MediaStore,
  makeMediaStore,
} from "./store";
