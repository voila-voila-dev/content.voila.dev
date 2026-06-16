// The post detail page: read view (DetailView) with an inline edit mode
// (CollectionForm) and delete. Everything renders from the collection config.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { CollectionForm, DetailView } from "@voila/content-ui";
import { useState } from "react";
import config from "../../content.config";
import { client } from "../lib/content-client";
import { displayWidgets, editWidgets } from "../lib/widgets";

export const Route = createFileRoute("/admin/posts/$id")({
  component: PostDetail,
});

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function PostDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // `editing` is view state, not server data — it stays in component state.
  const [editing, setEditing] = useState(false);

  const post = useQuery({
    queryKey: ["posts", id],
    queryFn: () => client.posts.find(id),
  });

  // On a successful save, prime this doc's cache with the response and
  // invalidate the list so it reflects the edit, then drop back to read mode.
  const update = useMutation({
    mutationFn: (values: Parameters<typeof client.posts.update>[1]) =>
      client.posts.update(id, values),
    onSuccess: (updated) => {
      queryClient.setQueryData(["posts", id], updated);
      queryClient.invalidateQueries({ queryKey: ["posts", "list"] });
      setEditing(false);
    },
  });

  const remove = useMutation({
    mutationFn: () => client.posts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", "list"] });
      navigate({ to: "/admin/posts" });
    },
  });

  if (post.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (post.error)
    return <p className="text-sm text-destructive">{errorMessage(post.error)}</p>;
  if (!post.data) return <p className="text-sm text-muted-foreground">Not found.</p>;

  if (editing) {
    return (
      <section className="max-w-xl space-y-4">
        <h2 className="text-lg font-semibold">Edit post</h2>
        <CollectionForm
          collection={config.collections.posts}
          registry={editWidgets}
          defaultValues={post.data}
          error={errorMessage(update.error)}
          submitLabel="Save"
          onSubmit={(values) => update.mutate(values)}
        />
      </section>
    );
  }

  return (
    <DetailView
      collection={config.collections.posts}
      registry={displayWidgets}
      doc={post.data}
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm font-medium text-primary"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="text-sm font-medium text-destructive disabled:opacity-60"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
          <Link to="/admin/posts" className="text-sm text-muted-foreground">
            Back
          </Link>
        </div>
      }
    />
  );
}
