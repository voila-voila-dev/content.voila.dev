import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { AnyFieldDef } from "@voila/content-schema";
import { Button, cn, Table } from "@voila/ui";
import { CaretDownIcon, CaretUpIcon, FilesIcon } from "@voila/ui/icons";
import { useMemo } from "react";
import type { AnyCollection, AnyContent } from "../types.ts";
import { fetchList, type ListParams, queryKeys } from "./api-client.ts";
import { EmptyState } from "./empty-state.tsx";
import { formatFieldValue } from "./field-display.tsx";
import { formatDateTime } from "./format.ts";
import { humanizeFieldName } from "./humanize.ts";
import { PageLayout } from "./page-layout.tsx";

/**
 * Read-only collection list view. Wraps TanStack Table over the cursor-
 * paginated `GET /admin/api/:collection` endpoint, with sortable headers
 * that update `?orderBy` / `?order` so the loader can re-prefetch and
 * Back/Forward stays addressable.
 *
 * Columns default to `collection.list.columns` (typed against the field
 * record), falling back to every declared field plus `updatedAt` when
 * unset. `id` is always rendered first so the row links back to detail.
 */

const SYSTEM_LABELS: Record<string, string> = {
  id: "ID",
  createdAt: "Created",
  updatedAt: "Updated",
};

type SystemKind = "string" | "datetime";
const SYSTEM_KINDS: Record<string, SystemKind> = {
  id: "string",
  createdAt: "datetime",
  updatedAt: "datetime",
};

type Row = Record<string, unknown> & { id: string };

export interface CollectionListSearch {
  cursor?: string;
  orderBy?: string;
  order?: "asc" | "desc";
}

export interface CollectionListViewProps {
  config: AnyContent;
  collection: AnyCollection;
}

function resolveColumns(collection: AnyCollection): string[] {
  const declared = collection.list?.columns;
  if (declared && declared.length > 0) {
    return Array.from(new Set(["id", ...declared]));
  }
  const fieldKeys = Object.keys(collection.fields).filter(
    (k) => collection.fields[k]?.hidden !== true && collection.fields[k]?.hidden !== "list",
  );
  return ["id", ...fieldKeys, "updatedAt"];
}

function isSortable(collection: AnyCollection, key: string): boolean {
  if (SYSTEM_KINDS[key]) return true;
  const field = collection.fields[key];
  if (!field) return false;
  return ["string", "number", "boolean", "date", "datetime"].includes(field.kind);
}

function labelFor(collection: AnyCollection, key: string): string {
  if (SYSTEM_LABELS[key]) return SYSTEM_LABELS[key];
  const field = collection.fields[key] as AnyFieldDef | undefined;
  return field?.label ?? humanizeFieldName(key);
}

function renderCell(collection: AnyCollection, key: string, value: unknown) {
  if (SYSTEM_KINDS[key] === "datetime") {
    return value == null ? "—" : formatDateTime(value);
  }
  if (key === "id") return value == null ? "—" : String(value);
  const field = collection.fields[key];
  if (!field) return value == null ? "—" : String(value);
  return formatFieldValue(field, value);
}

export function listQueryOptions(apiMount: string, collection: string, params: ListParams) {
  return {
    queryKey: queryKeys.list(collection, params),
    queryFn: () => fetchList(apiMount, collection, params),
  };
}

export function CollectionListView({ config, collection }: CollectionListViewProps) {
  const search = useSearch({ strict: false }) as CollectionListSearch;
  const navigate = useNavigate();
  const apiMount = config.mount.api;
  const adminMount = config.mount.admin;

  const params: ListParams = {
    cursor: search.cursor ?? null,
    orderBy: search.orderBy,
    order: search.order,
  };

  // Data is prefetched by the route loader (`ensureQueryData`) so SSR hands a
  // fully-resolved cache to the client; `useSuspenseQuery` reads it without a
  // render-blocking fetch. The route's `pendingComponent` shows the skeleton
  // during slow client navigations.
  const { data } = useSuspenseQuery(listQueryOptions(apiMount, collection.slug, params));

  const columnKeys = useMemo(() => resolveColumns(collection), [collection]);

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      columnKeys.map((key) => ({
        id: key,
        accessorKey: key,
        header: labelFor(collection, key),
        enableSorting: isSortable(collection, key),
        cell: (ctx) => {
          const value = ctx.getValue();
          const detailHref = `${adminMount}/collections/${collection.slug}/${ctx.row.original.id}`;
          if (key === "id") {
            return (
              <Link
                to={detailHref}
                className="font-mono text-xs underline-offset-2 hover:underline"
              >
                {String(value ?? "")}
              </Link>
            );
          }
          return renderCell(collection, key, value);
        },
      })),
    [collection, columnKeys, adminMount],
  );

  const rowsData = (data.data ?? []) as Row[];
  const table = useReactTable({
    data: rowsData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    state: {
      sorting:
        search.orderBy && isSortable(collection, search.orderBy)
          ? [{ id: search.orderBy, desc: search.order !== "asc" }]
          : [],
    },
  });

  const setSort = (key: string) => {
    if (!isSortable(collection, key)) return;
    const isActive = search.orderBy === key;
    const nextOrder: "asc" | "desc" = isActive && search.order === "asc" ? "desc" : "asc";
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        orderBy: key,
        order: nextOrder,
        cursor: undefined,
      }),
      replace: true,
    });
  };

  const rows = table.getRowModel().rows;
  const isEmpty = rows.length === 0 && !search.cursor;

  return (
    <PageLayout.Root>
      <PageLayout.Header>
        <div>
          <PageLayout.Title>{collection.label ?? collection.slug}</PageLayout.Title>
          {collection.description ? (
            <p className="text-muted-foreground text-sm">{collection.description}</p>
          ) : null}
        </div>
      </PageLayout.Header>
      <PageLayout.Body>
        {isEmpty ? (
          <EmptyState
            icon={FilesIcon}
            title="No records yet"
            description={`No rows in "${collection.label ?? collection.slug}".`}
          />
        ) : (
          <div className="grid gap-4">
            <Table.Root>
              <Table.Header>
                {table.getHeaderGroups().map((group) => (
                  <Table.Row key={group.id}>
                    {group.headers.map((header) => {
                      const sortable = header.column.getCanSort();
                      const sort = header.column.getIsSorted();
                      return (
                        <Table.Head key={header.id}>
                          {sortable ? (
                            <button
                              type="button"
                              onClick={() => setSort(header.column.id)}
                              className={cn(
                                "inline-flex items-center gap-1 font-medium",
                                "hover:text-foreground",
                                sort && "text-foreground",
                              )}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {sort === "asc" ? <CaretUpIcon className="size-3" /> : null}
                              {sort === "desc" ? <CaretDownIcon className="size-3" /> : null}
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </Table.Head>
                      );
                    })}
                  </Table.Row>
                ))}
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <Table.Row key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <Table.Cell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">
                {rows.length} {rows.length === 1 ? "row" : "rows"}
              </span>
              <div className="flex gap-2">
                {search.cursor ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate({
                        to: ".",
                        search: (prev: Record<string, unknown>) => ({
                          ...prev,
                          cursor: undefined,
                        }),
                        replace: true,
                      })
                    }
                  >
                    Reset
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.nextCursor}
                  onClick={() =>
                    navigate({
                      to: ".",
                      search: (prev: Record<string, unknown>) => ({
                        ...prev,
                        cursor: data.nextCursor ?? undefined,
                      }),
                    })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </PageLayout.Body>
    </PageLayout.Root>
  );
}
