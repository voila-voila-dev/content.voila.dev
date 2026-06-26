// Saved-view mutations for the collection list screen, in one place. Each
// returns a TanStack `useMutation`; the hook owns the cache side-effects
// (invalidating the collection's `views` query), while UI side-effects that need
// component state (selecting the just-created view, clearing the selection on
// delete) are passed in as callbacks.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { NewView, SavedView, ViewConfig, ViewType } from "@voila/content/client";
import { useAdmin } from "../context";
import { collectionClient } from "../lib/client-access";

export interface ViewMutationCallbacks {
  /** The view just created (so the host can make it active). */
  readonly onCreated?: (view: SavedView) => void;
  /** Called after the active view is deleted (so the host can deselect it). */
  readonly onDeleted?: () => void;
}

export function useViewMutations(slug: string, callbacks: ViewMutationCallbacks = {}) {
  const { admin } = useAdmin();
  const api = collectionClient(admin.client, slug);
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [slug, "views"] });

  const create = useMutation({
    mutationFn: (view: NewView) => api.views.create(view),
    onSuccess: (created) => {
      invalidate();
      callbacks.onCreated?.(created);
    },
  });

  const update = useMutation({
    mutationFn: (input: { id: string; config: ViewConfig; type: ViewType }) =>
      api.views.update(input.id, { config: input.config, type: input.type }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.views.delete(id),
    onSuccess: () => {
      invalidate();
      callbacks.onDeleted?.();
    },
  });

  const rename = useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      api.views.update(input.id, { name: input.name }),
    onSuccess: invalidate,
  });

  // Setting a default clears any other default for this collection (enforced in
  // the store); refetch so the star + auto-select reflect it.
  const setDefault = useMutation({
    mutationFn: (input: { id: string; isDefault: boolean }) =>
      api.views.update(input.id, { isDefault: input.isDefault }),
    onSuccess: invalidate,
  });

  // Persist a drag-reordered tab order (the complete ordered list of view ids).
  const reorder = useMutation({
    mutationFn: (ids: ReadonlyArray<string>) => api.views.reorder(ids),
    onSuccess: invalidate,
  });

  return { create, update, remove, rename, setDefault, reorder };
}
