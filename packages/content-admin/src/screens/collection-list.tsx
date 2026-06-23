// The list screen for ANY collection: one definition serves every collection by
// reading `params.collection` against the config. Keyset pagination as an
// infinite query, the schema-driven `ListView` for rendering. Mounted by the
// host's fixed `admin.$collection.index.tsx` shim.

import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import { ListView } from "@voila/content-ui";
import type { ReactNode } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { collectionClient } from "../lib/client-access";
import { CustomScreenDispatcher } from "./custom-dispatcher";
import { SingletonScreen } from "./singleton";

export function CollectionListScreen(): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const { collection: slug } = useParams({ strict: false }) as { collection: string };
  const collection = admin.config.collections[slug] as Collection | undefined;
  const isSingleton = admin.config.singletons[slug] !== undefined;

  const api = collectionClient(admin.client, slug);
  const query = useInfiniteQuery({
    queryKey: [slug, "list"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.list(pageParam ? { cursor: pageParam } : undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: collection !== undefined,
  });

  if (isSingleton) return <SingletonScreen slug={slug} />;
  // Not a collection or singleton → the path is a custom screen caught by the
  // `$collection` route; hand off to the dispatcher (which 404s if unregistered).
  if (!collection) return <CustomScreenDispatcher />;

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <ListView
      collection={collection}
      rows={rows}
      registry={admin.displayWidgets}
      loading={query.isLoading || query.isFetchingNextPage}
      error={query.error instanceof Error ? query.error.message : undefined}
      nextCursor={query.hasNextPage ? "more" : null}
      onLoadMore={() => query.fetchNextPage()}
      onRowClick={(row) => navigate({ href: `${admin.basePath}/${slug}/${row.id}` })}
      actions={
        <div className="flex items-center gap-3">
          {admin.slots.collection?.listActions?.({ slug, client: admin.client })}
          <AdminLink
            href={`${admin.basePath}/${slug}/new`}
            className="text-sm font-medium text-primary"
          >
            New
          </AdminLink>
        </div>
      }
    />
  );
}
