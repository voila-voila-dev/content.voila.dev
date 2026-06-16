import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ListView } from "@voila/content-ui";
import config from "../../content.config";
import { client } from "../lib/content-client";

export const Route = createFileRoute("/admin/posts/")({
  component: PostsList,
});

function PostsList() {
  const navigate = useNavigate();

  // Keyset pagination as an infinite query: each page's `nextCursor` becomes the
  // next page param and the cached pages flatten into the table rows.
  const firstPage: string | undefined = undefined;
  const query = useInfiniteQuery({
    queryKey: ["posts", "list"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      client.posts.list(pageParam ? { cursor: pageParam } : undefined),
    initialPageParam: firstPage,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ListView
      collection={config.collections.posts}
      rows={rows}
      loading={query.isLoading || query.isFetchingNextPage}
      error={query.error instanceof Error ? query.error.message : undefined}
      nextCursor={query.hasNextPage ? "more" : null}
      onLoadMore={() => query.fetchNextPage()}
      onRowClick={(row) => navigate({ to: `/admin/posts/${row.id}` })}
      actions={
        <Link to="/admin/posts/new" className="text-sm font-medium text-primary">
          New post
        </Link>
      }
    />
  );
}
