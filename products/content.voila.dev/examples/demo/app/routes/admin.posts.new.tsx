import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CollectionForm } from "@voila/content-ui";
import config from "../../content.config";
import { client } from "../lib/content-client";

export const Route = createFileRoute("/admin/posts/new")({
  component: NewPost,
});

function NewPost() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // React Query tracks the in-flight create, so the form can't double-submit
  // and the error surfaces straight from `create.error`.
  const create = useMutation({
    mutationFn: (values: Parameters<typeof client.posts.create>[0]) => client.posts.create(values),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["posts", "list"] });
      navigate({ to: `/admin/posts/${doc.id}` });
    },
  });

  return (
    <section className="max-w-xl space-y-4">
      <h2 className="text-lg font-semibold">New post</h2>
      <CollectionForm
        collection={config.collections.posts}
        error={create.error instanceof Error ? create.error.message : undefined}
        submitLabel="Create"
        onSubmit={(values) => create.mutate(values)}
      />
    </section>
  );
}
