// Document writes for a collection (create / update / delete), shared by the
// new, detail, and list (kanban move) screens. The hook owns the cache
// side-effects — invalidating the list and, on update, refreshing the edited
// document's cache; screen-specific UI (navigation, leaving edit mode) is added
// per call via `mutate(vars, { onSuccess })`.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc } from "@voila/content-ui";
import { useAdmin } from "../context";
import { collectionClient } from "../lib/client-access";

export function useCollectionMutations(slug: string) {
  const { admin } = useAdmin();
  const api = collectionClient(admin.client, slug);
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: [slug, "list"] });

  const create = useMutation({
    mutationFn: (values: Doc) => api.create(values),
    onSuccess: invalidateList,
  });

  const update = useMutation({
    mutationFn: (input: { id: string; values: Doc }) => api.update(input.id, input.values),
    onSuccess: (updated, input) => {
      queryClient.setQueryData([slug, input.id], updated);
      invalidateList();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(id),
    onSuccess: invalidateList,
  });

  return { create, update, remove };
}
