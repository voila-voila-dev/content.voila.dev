// The list screen for ANY collection: one definition serves every collection by
// reading `params.collection` against the config. Keyset pagination as an
// infinite query; the schema-driven `ListView` renders rows. Per-user saved
// views (columns + sort + filters) load from and persist to the typed client's
// `views` sub-API, switchable via `ViewSwitcher`; `ColumnPicker` edits the
// visible columns and sortable headers drive the sort. Mounted by the host's
// fixed `admin.$collection.index.tsx` shim.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import type { ListFilter, NewView, ViewConfig, ViewType } from "@voila/content/client";
import type { Doc, FieldChoice, ViewType as UiViewType } from "@voila/content-ui";
import {
  ColumnPicker,
  FilterBuilder,
  getFieldLabel,
  KanbanView,
  ListView,
  MapView,
  ViewSwitcher,
} from "@voila/content-ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../context";
import { AdminLink } from "../lib/admin-link";
import { type AnyListParams, collectionClient } from "../lib/client-access";
import { CustomScreenDispatcher } from "./custom-dispatcher";
import { SingletonScreen } from "./singleton";

// Board/map views need (nearly) all rows, not one keyset page — fetch the server
// max per page and auto-load up to this many pages (a hard cap so a huge
// collection can't load forever; a notice shows when capped). Server-side
// filters keep the working set small.
const BOARD_PAGE_LIMIT = 100;
const BOARD_PAGE_CAP = 5;

/** The collection's non-hidden field keys — the default visible columns. */
function defaultColumns(collection: Collection): string[] {
  return Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
}

/** Fields a kanban board can group by (a fixed, small set of values). */
function kanbanFields(collection: Collection): string[] {
  return Object.keys(collection.fields).filter((k) => {
    const kind = collection.fields[k]?.meta.kind;
    return kind === "enum" || kind === "select";
  });
}

/** Geo fields a map view can plot. */
function geoFields(collection: Collection): string[] {
  return Object.keys(collection.fields).filter((k) => collection.fields[k]?.meta.kind === "geo");
}

// Stable string form of a view config, for dirty detection (insertion order is
// fixed here, so plain string compare is enough).
function normalizeConfig(config: ViewConfig): string {
  return JSON.stringify({
    columns: config.columns ?? null,
    sort: config.sort ?? null,
    filters: config.filters ?? null,
    kanbanField: config.kanbanField ?? null,
    geoField: config.geoField ?? null,
  });
}

export function CollectionListScreen(): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { collection: slug } = useParams({ strict: false }) as { collection: string };
  const collection = admin.config.collections[slug] as Collection | undefined;
  const isSingleton = admin.config.singletons[slug] !== undefined;

  const api = collectionClient(admin.client, slug);

  // The signed-in user's saved views for this collection.
  const viewsQuery = useQuery({
    queryKey: [slug, "views"],
    queryFn: () => api.views.list(),
    enabled: collection !== undefined && !isSingleton,
  });
  const savedViews = viewsQuery.data ?? [];

  // The active view + the working config it edits. `null` is the unsaved default.
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [viewType, setViewType] = useState<ViewType>("table");
  const [working, setWorking] = useState<ViewConfig>({});
  const activeView = savedViews.find((v) => v.id === activeViewId) ?? null;

  function selectView(id: string | null) {
    const view = id === null ? null : (savedViews.find((v) => v.id === id) ?? null);
    setActiveViewId(view ? view.id : null);
    setWorking(view ? view.config : {});
    setViewType(view ? view.type : "table");
  }

  // The screen is reused across every `$collection` route (no remount on
  // navigation), so reset the per-collection view state when the slug changes —
  // otherwise the previous collection's filters/sort/columns/active view leak in
  // and break the next collection's list query (unknown-field 400s, wrong
  // columns, a phantom selection).
  const autoSelected = useRef(false);
  const [prevSlug, setPrevSlug] = useState(slug);
  if (slug !== prevSlug) {
    setPrevSlug(slug);
    setActiveViewId(null);
    setWorking({});
    setViewType("table");
    autoSelected.current = false;
  }

  // Auto-select the user's default view once this collection's views load.
  useEffect(() => {
    if (autoSelected.current || !viewsQuery.isSuccess) return;
    autoSelected.current = true;
    const fallback = savedViews.find((v) => v.isDefault);
    if (fallback) selectView(fallback.id);
    // Keyed on slug too, so navigating to another collection re-runs after the
    // reset above clears `autoSelected`.
  }, [slug, viewsQuery.isSuccess]);

  // Feed the working config's sort + filters into the list request.
  const listParams = useMemo<AnyListParams>(() => {
    const params: { -readonly [K in keyof AnyListParams]: AnyListParams[K] } = {};
    if (working.sort) {
      params.orderBy = working.sort.field;
      params.order = working.sort.direction;
    }
    if (working.filters && working.filters.length > 0) params.filters = working.filters;
    return params;
  }, [working.sort, working.filters]);

  const isBoardView = viewType === "kanban" || viewType === "map";

  const query = useInfiniteQuery({
    queryKey: [slug, "list", listParams, isBoardView],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.list({
        ...listParams,
        ...(isBoardView ? { limit: BOARD_PAGE_LIMIT } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: collection !== undefined,
  });

  // Board/map views: keep pulling pages (up to the cap) until the set is loaded.
  const loadedPages = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (!isBoardView) return;
    if (query.hasNextPage && !query.isFetchingNextPage && loadedPages < BOARD_PAGE_CAP) {
      void query.fetchNextPage();
    }
  }, [isBoardView, query.hasNextPage, query.isFetchingNextPage, loadedPages, query.fetchNextPage]);

  const invalidateViews = () => queryClient.invalidateQueries({ queryKey: [slug, "views"] });
  // Moving a kanban card patches the grouped field; the list refetches.
  const updateRow = useMutation({
    mutationFn: (input: { id: string; values: Doc }) => api.update(input.id, input.values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [slug, "list"] }),
  });
  const createView = useMutation({
    mutationFn: (view: NewView) => api.views.create(view),
    onSuccess: (created) => {
      invalidateViews();
      setActiveViewId(created.id);
    },
  });
  const updateView = useMutation({
    mutationFn: (input: { id: string; config: ViewConfig; type: ViewType }) =>
      api.views.update(input.id, { config: input.config, type: input.type }),
    onSuccess: invalidateViews,
  });
  const deleteView = useMutation({
    mutationFn: (id: string) => api.views.delete(id),
    onSuccess: () => {
      invalidateViews();
      selectView(null);
    },
  });

  if (isSingleton) return <SingletonScreen slug={slug} />;
  // Not a collection or singleton → a custom screen caught by the `$collection`
  // route; hand off to the dispatcher (which 404s if unregistered).
  if (!collection) return <CustomScreenDispatcher />;

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const visibleColumns =
    working.columns && working.columns.length > 0 ? working.columns : defaultColumns(collection);
  const dirty =
    activeView !== null &&
    (normalizeConfig(working) !== normalizeConfig(activeView.config) ||
      viewType !== activeView.type);

  // Which view types this collection can offer (kanban needs an enum/select
  // field; map needs a geo field), and the field each one uses.
  const kanbanable = kanbanFields(collection);
  const geoable = geoFields(collection);
  const availableTypes: UiViewType[] = [
    "table",
    ...(kanbanable.length > 0 ? (["kanban"] as const) : []),
    ...(geoable.length > 0 ? (["map"] as const) : []),
  ];
  const kanbanField = working.kanbanField ?? kanbanable[0];
  const geoField = working.geoField ?? geoable[0];
  const cappedOut = isBoardView && query.hasNextPage && loadedPages >= BOARD_PAGE_CAP;

  // Field choices (key + display label) the view switcher offers for kanban
  // grouping / map plotting, so the user can pick rather than take the first.
  function fieldChoices(keys: ReadonlyArray<string>): FieldChoice[] {
    return keys.flatMap((key) => {
      const field = collection?.fields[key];
      return field ? [{ value: key, label: getFieldLabel(key, field) }] : [];
    });
  }

  function changeColumns(columns: string[]) {
    setWorking((prev) => ({ ...prev, columns }));
  }
  function changeSort(field: string) {
    setWorking((prev) => {
      const direction =
        prev.sort?.field === field && prev.sort.direction === "asc" ? "desc" : "asc";
      return { ...prev, sort: { field, direction } };
    });
  }
  function changeFilters(filters: ListFilter[]) {
    setWorking((prev) => ({ ...prev, filters }));
  }
  function changeKanbanField(field: string) {
    setWorking((prev) => ({ ...prev, kanbanField: field }));
  }
  function changeGeoField(field: string) {
    setWorking((prev) => ({ ...prev, geoField: field }));
  }
  function openRow(row: Doc) {
    navigate({ href: `${admin.basePath}/${slug}/${row.id}` });
  }

  // The shared header controls — view switcher, the column picker (table only),
  // host list actions, and the New link.
  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <ViewSwitcher
        viewType={viewType}
        onViewTypeChange={setViewType}
        views={savedViews}
        activeViewId={activeViewId}
        onSelectView={selectView}
        dirty={dirty}
        onSave={
          activeViewId
            ? () => updateView.mutate({ id: activeViewId, config: working, type: viewType })
            : undefined
        }
        onSaveAs={(name) => createView.mutate({ name, type: viewType, config: working })}
        onDelete={activeViewId ? () => deleteView.mutate(activeViewId) : undefined}
        availableTypes={availableTypes}
        kanbanFields={fieldChoices(kanbanable)}
        kanbanField={kanbanField}
        onKanbanFieldChange={changeKanbanField}
        geoFields={fieldChoices(geoable)}
        geoField={geoField}
        onGeoFieldChange={changeGeoField}
      />
      <FilterBuilder
        collection={collection}
        value={working.filters ?? []}
        onChange={changeFilters}
      />
      {viewType === "table" ? (
        <ColumnPicker collection={collection} value={visibleColumns} onChange={changeColumns} />
      ) : null}
      {admin.slots.collection?.listActions?.({ slug, client: admin.client })}
      <AdminLink
        href={`${admin.basePath}/${slug}/new`}
        className="text-sm font-medium text-primary"
      >
        New
      </AdminLink>
    </div>
  );

  // Board / map views render their own header (ListView is table-specific).
  if ((viewType === "kanban" && kanbanField) || (viewType === "map" && geoField)) {
    return (
      <section className="space-y-4">
        <header className="flex items-start gap-4">
          <h1 tabIndex={-1} className="text-lg font-semibold focus:outline-none">
            {collection.label ?? slug}
          </h1>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>
        {cappedOut ? (
          <p className="text-sm text-muted-foreground">
            Showing the first {rows.length} records. Narrow the set with a filter to see more.
          </p>
        ) : null}
        {viewType === "kanban" && kanbanField ? (
          <KanbanView
            collection={collection}
            rows={rows}
            groupField={kanbanField}
            registry={admin.displayWidgets}
            onRowClick={openRow}
            onMove={(rowId, value) =>
              updateRow.mutate({ id: rowId, values: { [kanbanField]: value } })
            }
          />
        ) : geoField ? (
          <MapView
            collection={collection}
            rows={rows}
            geoField={geoField}
            mapStyleUrl={admin.mapStyleUrl}
            onRowClick={openRow}
          />
        ) : null}
      </section>
    );
  }

  return (
    <ListView
      collection={collection}
      rows={rows}
      columns={visibleColumns}
      registry={admin.displayWidgets}
      loading={query.isLoading || query.isFetchingNextPage}
      error={query.error instanceof Error ? query.error.message : undefined}
      nextCursor={query.hasNextPage ? "more" : null}
      onLoadMore={() => query.fetchNextPage()}
      onRowClick={openRow}
      sort={working.sort}
      onSortChange={changeSort}
      actions={actions}
    />
  );
}
