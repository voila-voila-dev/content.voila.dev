// The single write a singleton supports: `set` (upsert the one row). The hook
// owns the cache side-effect (refreshing the singleton's cache); leaving edit
// mode is the screen's, added per call via `mutate(vars, { onSuccess })`.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Doc, useMessages } from "@voila/content-ui";
import { toast } from "@voila.dev/ui/sonner";
import { useAdmin } from "../context";
import { singletonClient } from "../lib/client-access";
import { toastError } from "./use-collection-mutations";

export function useSingletonMutations(slug: string) {
  const { admin } = useAdmin();
  const api = singletonClient(admin.client, slug);
  const queryClient = useQueryClient();
  const messages = useMessages();

  const save = useMutation({
    mutationFn: (values: Doc) => api.set(values),
    onSuccess: (updated) => {
      queryClient.setQueryData([slug, "singleton"], updated);
      toast.success(messages.common.saved);
    },
    onError: (error) => toastError(error, messages.admin.couldNotSave),
  });

  return { save };
}
