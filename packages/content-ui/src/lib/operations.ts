// operations — which write operations a collection offers, with the defaults
// resolved. `CollectionDef.operations` leaves every switch optional (all on
// unless said otherwise), so every admin surface that gates a New / Edit /
// Delete affordance would otherwise repeat the same `!== false` dance. One
// helper keeps the default in one place; the REST layer answers
// `405 NOT_SUPPORTED` for the same switches, so hiding the UI is the whole
// client-side story.

import type { Collection } from "@voila/content";

export interface ResolvedCollectionOperations {
  readonly create: boolean;
  readonly update: boolean;
  readonly delete: boolean;
}

/** The collection's write operations, every switch resolved to a boolean. */
export function collectionOperations(
  collection: Pick<Collection, "operations">,
): ResolvedCollectionOperations {
  const ops = collection.operations;
  return {
    create: ops?.create !== false,
    update: ops?.update !== false,
    delete: ops?.delete !== false,
  };
}
