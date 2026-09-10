// Document writes for a collection (create / update / delete), shared by the
// new, detail, and list (kanban move) screens. The hook owns the cache
// side-effects — invalidating the list and, on update, refreshing the edited
// document's cache; screen-specific UI (navigation, leaving edit mode) is added
// per call via `mutate(vars, { onSuccess })`.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Doc } from "@voila/content-ui";
import { toast } from "@voila.dev/ui/sonner";
import { useAdmin } from "../context";
import { collectionClient } from "../lib/client-access";
import { errorMessage } from "../lib/field-errors";

/** Surface a failed write as a toast (the screens also show field errors inline). */
export function toastError(error: unknown, fallback: string): void {
  toast.error(errorMessage(error) ?? fallback);
}

export function useCollectionMutations(slug: string) {
  const { admin } = useAdmin();
  const api = collectionClient(admin.client, slug);
  const queryClient = useQueryClient();
  const invalidateList = () => queryClient.invalidateQueries({ queryKey: [slug, "list"] });

  const create = useMutation({
    mutationFn: (values: Doc) => api.create(values),
    onSuccess: () => {
      toast.success("Created");
      return invalidateList();
    },
    onError: (error) => toastError(error, "Could not create the record."),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; values: Doc }) => api.update(input.id, input.values),
    onSuccess: (updated, input) => {
      queryClient.setQueryData([slug, input.id], updated);
      toast.success("Saved");
      return invalidateList();
    },
    onError: (error) => toastError(error, "Could not save the changes."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(id),
    onSuccess: () => {
      toast.success("Deleted");
      return invalidateList();
    },
    onError: (error) => toastError(error, "Could not delete the record."),
  });

  // Bulk soft-delete: one request per id, settled together; partial failures
  // surface as one toast naming the count. Deletes are SOFT, so the toast
  // offers Undo — the safety net that makes a destructive bulk action
  // reasonable to reach for at all.
  const removeMany = useMutation({
    mutationFn: async (ids: ReadonlyArray<string>) => {
      const results = await Promise.allSettled(ids.map((id) => api.delete(id)));
      const deleted = ids.filter((_, i) => results[i]?.status === "fulfilled");
      return { deleted, failed: ids.length - deleted.length };
    },
    onSuccess: ({ deleted, failed }) => {
      const n = deleted.length;
      if (failed > 0) toast.error(`Deleted ${n}, ${failed} failed.`);
      else {
        toast.success(`Deleted ${n} ${n === 1 ? "record" : "records"}`, {
          action: {
            label: "Undo",
            onClick: () => restoreMany.mutate(deleted),
          },
        });
      }
      return invalidateList();
    },
  });

  // The other half of the undo: soft-deleted rows revive through `restore`.
  const restoreMany = useMutation({
    mutationFn: async (ids: ReadonlyArray<string>) => {
      const results = await Promise.allSettled(ids.map((id) => api.restore(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      return { restored: ids.length - failed, failed };
    },
    onSuccess: ({ restored, failed }) => {
      if (failed > 0) toast.error(`Restored ${restored}, ${failed} failed.`);
      else toast.success(`Restored ${restored} ${restored === 1 ? "record" : "records"}`);
      return invalidateList();
    },
    onError: (error) => toastError(error, "Could not undo the delete."),
  });

  /**
   * Set one field to one value across a selection — the bulk "move these to
   * In review" / "publish these" action. A PATCH per id, settled together, so a
   * row that fails its own validation doesn't take the rest of the batch down.
   */
  const updateMany = useMutation({
    mutationFn: async (input: {
      readonly ids: ReadonlyArray<string>;
      readonly values: Doc;
      /** What the toast says on success, e.g. "Moved to In review". */
      readonly label: string;
    }) => {
      const results = await Promise.allSettled(input.ids.map((id) => api.update(id, input.values)));
      const failed = results.filter((r) => r.status === "rejected").length;
      return { updated: input.ids.length - failed, failed, label: input.label };
    },
    onSuccess: ({ updated, failed, label }) => {
      if (failed > 0) toast.error(`${label}: ${updated} updated, ${failed} failed.`);
      else toast.success(`${label} · ${updated} ${updated === 1 ? "record" : "records"}`);
      return invalidateList();
    },
    onError: (error) => toastError(error, "Could not apply the change."),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.publish(id),
    onSuccess: (updated, id) => {
      queryClient.setQueryData([slug, id], updated);
      toast.success("Published");
      return invalidateList();
    },
    onError: (error) => toastError(error, "Could not publish."),
  });

  const unpublish = useMutation({
    mutationFn: (id: string) => api.unpublish(id),
    onSuccess: (updated, id) => {
      queryClient.setQueryData([slug, id], updated);
      toast.success("Unpublished");
      return invalidateList();
    },
    onError: (error) => toastError(error, "Could not unpublish."),
  });

  const restoreRevision = useMutation({
    mutationFn: (input: { id: string; rev: number }) => api.restoreRevision(input.id, input.rev),
    onSuccess: (updated, input) => {
      queryClient.setQueryData([slug, input.id], updated);
      toast.success(`Restored revision ${input.rev}`);
      return Promise.all([
        invalidateList(),
        queryClient.invalidateQueries({ queryKey: [slug, input.id, "revisions"] }),
      ]);
    },
    onError: (error) => toastError(error, "Could not restore the revision."),
  });

  return {
    create,
    update,
    remove,
    removeMany,
    restoreMany,
    updateMany,
    publish,
    unpublish,
    restoreRevision,
  };
}
