import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { AnyFieldDef } from "@voila/content-schema";
import { Button } from "@voila/ui";
import { ArrowLeftIcon, FileXIcon } from "@voila/ui/icons";
import type { ReactNode } from "react";
import type { AnyCollection, AnyContent } from "../types.ts";
import { ApiError, fetchById, queryKeys } from "./api-client.ts";
import { EmptyState } from "./empty-state.tsx";
import { ReadOnlyField } from "./field-display.tsx";
import { formatDateTime } from "./format.ts";
import { PageLayout } from "./page-layout.tsx";

/**
 * Read-only detail view for a single record in a collection. Iterates the
 * collection's `fields` record in declaration order and emits a
 * `ReadOnlyField` per entry. System columns (`id`, `createdAt`, `updatedAt`)
 * render at the top in a muted metadata strip so users can still copy the id.
 */

export interface CollectionDetailViewProps {
  config: AnyContent;
  collection: AnyCollection;
  id: string;
}

export function detailQueryOptions(apiMount: string, collection: string, id: string) {
  return {
    queryKey: queryKeys.byId(collection, id),
    queryFn: async () => {
      try {
        return await fetchById(apiMount, collection, id);
      } catch (err) {
        if (err instanceof ApiError && err.code === "NOT_FOUND") {
          return { data: null as Record<string, unknown> | null };
        }
        throw err;
      }
    },
  };
}

export function CollectionDetailView({ config, collection, id }: CollectionDetailViewProps) {
  const adminMount = config.mount.admin;
  const apiMount = config.mount.api;
  const listHref = `${adminMount}/collections/${collection.slug}/`;

  // Prefetched by the route loader; the route's `pendingComponent` renders the
  // skeleton during slow client navigations (see admin-views.ts).
  const { data } = useSuspenseQuery(detailQueryOptions(apiMount, collection.slug, id));

  const row = data.data as Record<string, unknown> | null;

  if (!row) {
    return (
      <PageLayout.Root>
        <PageLayout.Header>
          <BackToList href={listHref} label={collection.label ?? collection.slug} />
        </PageLayout.Header>
        <PageLayout.Body>
          <EmptyState
            icon={FileXIcon}
            title="Record not found"
            description={`No record with id "${id}".`}
          />
        </PageLayout.Body>
      </PageLayout.Root>
    );
  }

  const fieldEntries = (Object.entries(collection.fields) as Array<[string, AnyFieldDef]>).filter(
    ([, field]) => field.hidden !== true && field.hidden !== "detail",
  );

  return (
    <PageLayout.Root>
      <PageLayout.Header>
        <div className="grid gap-2">
          <BackToList href={listHref} label={collection.label ?? collection.slug} />
          <PageLayout.Title>{titleOf(row, collection)}</PageLayout.Title>
        </div>
      </PageLayout.Header>
      <PageLayout.Body className="grid gap-8">
        <MetadataStrip row={row} />
        <div className="grid gap-6">
          {fieldEntries.map(([name, field]) => (
            <ReadOnlyField key={name} field={field} name={name} value={row[name]} />
          ))}
        </div>
      </PageLayout.Body>
    </PageLayout.Root>
  );
}

function BackToList({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 w-fit"
      render={
        <Link to={href}>
          <ArrowLeftIcon className="size-4" />
          {label}
        </Link>
      }
    />
  );
}

function MetadataStrip({ row }: { row: Record<string, unknown> }) {
  return (
    <dl className="grid grid-cols-1 gap-4 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-3">
      <Meta label="ID" value={row.id ? <code className="font-mono">{String(row.id)}</code> : "—"} />
      <Meta label="Created" value={fmtDate(row.createdAt)} />
      <Meta label="Updated" value={fmtDate(row.updatedAt)} />
    </dl>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="font-medium text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function fmtDate(value: unknown): string {
  return value == null ? "—" : formatDateTime(value);
}

function titleOf(row: Record<string, unknown>, collection: AnyCollection): string {
  for (const key of ["title", "name", "label", "slug"]) {
    const v = row[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return `${collection.label ?? collection.slug}/${String(row.id ?? "")}`;
}
