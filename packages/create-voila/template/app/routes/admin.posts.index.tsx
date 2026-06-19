// The posts list page. ListView renders the table from your config — columns,
// labels, and display widgets all derive from the collection's fields.

import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListView } from "@voila/content-ui";
import config from "../../content.config";
import { client } from "../lib/content-client";
import { displayWidgets } from "../lib/widgets";

export const Route = createFileRoute("/admin/posts/")({
  component: PostsList,
});

function PostsList() {
  const navigate = useNavigate();

  // Keyset pagination maps cleanly onto an infinite query: each page's
  // `nextCursor` becomes the next page param, and the cached pages flatten into
  // the table rows. React Query dedupes concurrent "Load more" clicks for us.
  // `undefined` cursor = the first page. Typing the constant (rather than
  // casting inline) lets the page-param type flow through the query as
  // `string | undefined`.
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
      registry={displayWidgets}
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
