import { useQuery } from "@tanstack/react-query";
import type { AnyFieldDef } from "@voila/content-schema";
import { DatabaseIcon } from "@voila/ui/icons";
import type { AnyContent, AnySingleton } from "../types.ts";
import { ApiError, fetchById, queryKeys } from "./api-client.ts";
import { EmptyState } from "./empty-state.tsx";
import { ReadOnlyField } from "./field-display.tsx";
import { PageLayout } from "./page-layout.tsx";
import { DetailSkeleton } from "./skeletons.tsx";

/**
 * Read-only view for a singleton document. Singletons share the collections
 * namespace at the API layer with `id === slug`, so the same find-by-id
 * handler powers this view.
 */

export interface SingletonViewProps {
  config: AnyContent;
  singleton: AnySingleton;
}

export function singletonQueryOptions(apiMount: string, slug: string) {
  return {
    queryKey: queryKeys.byId(slug, slug),
    queryFn: async () => {
      try {
        return await fetchById(apiMount, slug, slug);
      } catch (err) {
        if (err instanceof ApiError && err.code === "NOT_FOUND") {
          return { data: null as Record<string, unknown> | null };
        }
        throw err;
      }
    },
    // The admin SPA fetches client-side; relative URLs aren't valid during SSR.
    enabled: typeof window !== "undefined",
  };
}

export function SingletonView({ config, singleton }: SingletonViewProps) {
  const { data, isPending } = useQuery(singletonQueryOptions(config.mount.api, singleton.slug));

  if (isPending || !data) {
    return (
      <PageLayout.Root>
        <PageLayout.Header>
          <PageLayout.Title>{singleton.label ?? singleton.slug}</PageLayout.Title>
        </PageLayout.Header>
        <PageLayout.Body>
          <DetailSkeleton />
        </PageLayout.Body>
      </PageLayout.Root>
    );
  }

  const row = data.data;

  const fieldEntries = (Object.entries(singleton.fields) as Array<[string, AnyFieldDef]>).filter(
    ([, field]) => field.hidden !== true && field.hidden !== "detail",
  );

  return (
    <PageLayout.Root>
      <PageLayout.Header>
        <div>
          <PageLayout.Title>{singleton.label ?? singleton.slug}</PageLayout.Title>
          {singleton.description ? (
            <p className="text-muted-foreground text-sm">{singleton.description}</p>
          ) : null}
        </div>
      </PageLayout.Header>
      <PageLayout.Body>
        {!row ? (
          <EmptyState
            icon={DatabaseIcon}
            title="Not configured yet"
            description={`No record exists for "${singleton.label ?? singleton.slug}". It will appear once first saved.`}
          />
        ) : (
          <div className="grid gap-6">
            {fieldEntries.map(([name, field]) => (
              <ReadOnlyField key={name} field={field} name={name} value={row[name]} />
            ))}
          </div>
        )}
      </PageLayout.Body>
    </PageLayout.Root>
  );
}
