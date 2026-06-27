// The list screen for ANY collection: one definition serves every collection by
// reading `params.collection` against the config. Keyset pagination as an
// infinite query; the schema-driven `ListView` renders rows.
//
// Views are SHARED (the same for everyone) and Notion-style: a `ViewTabs` bar
// lists the collection's saved views — always at least a seeded, undeletable
// "Table" — and "+ Add view" creates more (a board/calendar/map), choosing the
// field(s) that type needs up front. The active view lives in the URL as
// `?view=<uid>` so a view is shareable by link; its `type` + `config` drive what
// renders. Editing columns / sort / filters / calendar granularity writes
// through to the shared view (no separate save step). Mounted by the host's
// fixed `admin.$collection.index.tsx` shim.

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import type { ListFilter, SavedView, ViewConfig } from "@voila/content/client";
import type { Doc, FieldChoice, ViewFieldChoices } from "@voila/content-ui";
import {
  CalendarView,
  ColumnEditor,
  FilterEditor,
  getFieldLabel,
  KanbanView,
  ListView,
  MapView,
  PageLayout,
  ViewTabs,
} from "@voila/content-ui";
import { buttonVariants } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import { FunnelIcon } from "@voila/ui/icons";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../context";
import { useCollectionMutations } from "../hooks/use-collection-mutations";
import { useViewMutations } from "../hooks/use-view-mutations";
import { AdminLink } from "../lib/admin-link";
import { type AnyListParams, collectionClient } from "../lib/client-access";
import { CustomScreenDispatcher } from "./custom-dispatcher";
import { SingletonScreen } from "./singleton";

// Board/map/calendar views need (nearly) all rows, not one keyset page — fetch
// the server max per page and auto-load up to this many pages (a hard cap so a
// huge collection can't load forever; a notice shows when capped).
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

/** Date/datetime fields a calendar view can lay events out by. */
function dateFields(collection: Collection): string[] {
  return Object.keys(collection.fields).filter((k) => {
    const kind = collection.fields[k]?.meta.kind;
    return kind === "date" || kind === "datetime";
  });
}

/** Pick the active view from the URL's `?view`, else the default / seeded / first. */
function resolveActiveView(views: ReadonlyArray<SavedView>, urlViewId?: string): SavedView | null {
  const fromUrl = urlViewId ? views.find((v) => v.id === urlViewId) : undefined;
  if (fromUrl) return fromUrl;
  return views.find((v) => v.isDefault) ?? views.find((v) => v.seeded) ?? views[0] ?? null;
}

export function CollectionListScreen(): ReactNode {
  const { admin } = useAdmin();
  const navigate = useNavigate();
  const { collection: slug } = useParams({ strict: false }) as { collection: string };
  // The active view id rides the URL (`?view=`), read loosely (the route doesn't
  // validate it) so a view is shareable and survives reloads.
  const search = useSearch({ strict: false }) as { readonly view?: string };
  const collection = admin.config.collections[slug] as Collection | undefined;
  const isSingleton = admin.config.singletons[slug] !== undefined;

  const api = collectionClient(admin.client, slug);

  // The collection's shared views (the default Table view is seeded on first read).
  const viewsQuery = useQuery({
    queryKey: [slug, "views"],
    queryFn: () => api.views.list(),
    enabled: collection !== undefined && !isSingleton,
  });
  const savedViews = viewsQuery.data ?? [];
  const activeView = resolveActiveView(savedViews, search.view);
  const activeViewId = activeView?.id ?? null;

  // A local mirror of the active view's config, for snappy edits; it resets when
  // the active view changes and writes through to the shared view on each edit.
  const [working, setWorking] = useState<ViewConfig>({});
  // Which inline section of the "Edit view" dialog is expanded (one at a time).
  const [editorPanel, setEditorPanel] = useState<"filters" | "fields" | "map" | null>(null);
  const loadedViewId = useRef<string | null>(null);
  if (activeView && activeView.id !== loadedViewId.current) {
    loadedViewId.current = activeView.id;
    setWorking(activeView.config);
  }

  const viewType = activeView?.type ?? "table";
  const isBoardView = viewType === "kanban" || viewType === "map" || viewType === "calendar";

  // Fetch only the fields the active view renders, so the list query stays lean
  // (especially the board "load all" path). `id` always comes back server-side;
  // the title field rides along for card/row titles. `undefined` → all columns
  // (e.g. a board view whose required field isn't set yet).
  const listFields = useMemo<readonly string[] | undefined>(() => {
    if (!collection) return undefined;
    const title = collection.titleField ? [collection.titleField] : [];
    const card = working.cardFields ?? [];
    if (viewType === "kanban") {
      return working.kanbanField ? [working.kanbanField, ...card, ...title] : undefined;
    }
    if (viewType === "map") {
      return working.geoField ? [working.geoField, ...card, ...title] : undefined;
    }
    if (viewType === "calendar") {
      return working.calendarField
        ? [
            working.calendarField,
            ...(working.calendarEndField ? [working.calendarEndField] : []),
            ...card,
            ...title,
          ]
        : undefined;
    }
    const cols =
      working.columns && working.columns.length > 0 ? working.columns : defaultColumns(collection);
    return [...cols, ...title];
  }, [
    collection,
    viewType,
    working.columns,
    working.cardFields,
    working.kanbanField,
    working.geoField,
    working.calendarField,
    working.calendarEndField,
  ]);

  const query = useInfiniteQuery({
    queryKey: [
      slug,
      "list",
      working.sort ?? null,
      working.filters ?? null,
      listFields ?? null,
      isBoardView,
    ],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.list({
        ...(working.sort ? { orderBy: working.sort.field, order: working.sort.direction } : {}),
        ...(working.filters && working.filters.length > 0 ? { filters: working.filters } : {}),
        ...(listFields ? { fields: listFields } : {}),
        ...(isBoardView ? { limit: BOARD_PAGE_LIMIT } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      } as AnyListParams),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: collection !== undefined,
  });

  // Board/map/calendar views: keep pulling pages (up to the cap) until loaded.
  const loadedPages = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (!isBoardView) return;
    if (query.hasNextPage && !query.isFetchingNextPage && loadedPages < BOARD_PAGE_CAP) {
      void query.fetchNextPage();
    }
  }, [isBoardView, query.hasNextPage, query.isFetchingNextPage, loadedPages, query.fetchNextPage]);

  const { update: updateRow } = useCollectionMutations(slug);

  function selectView(id: string) {
    navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, view: id }) });
  }

  // View CRUD; the hook invalidates the views query. Creating selects the new
  // view (via the URL); deleting falls back to the default/seeded view.
  const views = useViewMutations(slug, {
    onCreated: (created) => selectView(created.id),
    onDeleted: () => {
      const fallback = savedViews.find((v) => v.seeded) ?? savedViews.find((v) => v.isDefault);
      if (fallback) selectView(fallback.id);
    },
  });

  if (isSingleton) return <SingletonScreen slug={slug} />;
  // Not a collection or singleton → a custom screen caught by the `$collection`
  // route; hand off to the dispatcher (which 404s if unregistered).
  if (!collection) return <CustomScreenDispatcher />;

  const rows = query.data?.pages.flatMap((page) => page.data) ?? [];
  const visibleColumns =
    working.columns && working.columns.length > 0 ? working.columns : defaultColumns(collection);

  const kanbanable = kanbanFields(collection);
  const geoable = geoFields(collection);
  const dateable = dateFields(collection);

  // The field each board/map/calendar view uses, from its saved config.
  const kanbanField = working.kanbanField ?? kanbanable[0];
  const geoField = working.geoField ?? geoable[0];
  const calendarField = working.calendarField ?? dateable[0];
  const calendarEndField =
    working.calendarEndField && dateable.includes(working.calendarEndField)
      ? working.calendarEndField
      : undefined;
  const calendarView = working.calendarView ?? "month";
  const cappedOut = isBoardView && query.hasNextPage && loadedPages >= BOARD_PAGE_CAP;

  function fieldChoices(keys: ReadonlyArray<string>): FieldChoice[] {
    return keys.flatMap((key) => {
      const field = collection?.fields[key];
      return field ? [{ value: key, label: getFieldLabel(key, field) }] : [];
    });
  }
  const viewFields: ViewFieldChoices = {
    kanban: fieldChoices(kanbanable),
    geo: fieldChoices(geoable),
    date: fieldChoices(dateable),
  };

  // Write a config change through to the shared active view (snappy local mirror
  // + persistence). No-op without an active view (still loading).
  function patchConfig(patch: Partial<ViewConfig>) {
    if (!activeView) return;
    const next = { ...working, ...patch };
    setWorking(next);
    views.update.mutate({ id: activeView.id, config: next, type: activeView.type });
  }
  function changeColumns(columns: string[]) {
    patchConfig({ columns });
  }
  function changeSort(field: string) {
    const direction =
      working.sort?.field === field && working.sort.direction === "asc" ? "desc" : "asc";
    patchConfig({ sort: { field, direction } });
  }
  function changeFilters(filters: ListFilter[]) {
    patchConfig({ filters });
  }
  function changeCalendarView(view: "month" | "week" | "day") {
    patchConfig({ calendarView: view });
  }
  function openRow(row: Doc) {
    navigate({ href: `${admin.basePath}/${slug}/${row.id}` });
  }

  // The per-view editor — filters always; columns on the table view, card fields
  // on a board/map/calendar, plus the map's default position. Lives INLINE inside
  // the view's "Edit view" dialog (opened from a tab's context menu), bound to the
  // active view's config. Inline — not nested popovers — because a Base UI popover
  // opened inside a Base UI dialog renders behind the dialog's backdrop.
  const fieldsLabel = viewType === "table" ? "Columns" : "Card fields";
  const fieldsValue = viewType === "table" ? visibleColumns : (working.cardFields ?? []);
  const onFieldsChange =
    viewType === "table" ? changeColumns : (cardFields: string[]) => patchConfig({ cardFields });
  const filterCount = working.filters?.length ?? 0;

  function togglePanel(panel: "filters" | "fields" | "map") {
    setEditorPanel((current) => (current === panel ? null : panel));
  }

  const viewEditor = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <PanelToggle active={editorPanel === "filters"} onClick={() => togglePanel("filters")}>
          <FunnelIcon className="size-4" aria-hidden />
          {filterCount > 0 ? `Filters (${filterCount})` : "Filters"}
        </PanelToggle>
        <PanelToggle active={editorPanel === "fields"} onClick={() => togglePanel("fields")}>
          {fieldsLabel}
        </PanelToggle>
        {viewType === "map" ? (
          <PanelToggle active={editorPanel === "map"} onClick={() => togglePanel("map")}>
            Map position
          </PanelToggle>
        ) : null}
      </div>
      {editorPanel === "filters" ? (
        <div className="space-y-2 rounded-md border p-3">
          <FilterEditor
            collection={collection}
            value={working.filters ?? []}
            onChange={changeFilters}
          />
        </div>
      ) : null}
      {editorPanel === "fields" ? (
        <div className="max-h-56 overflow-auto rounded-md border p-3">
          <ColumnEditor
            collection={collection}
            value={fieldsValue}
            onChange={onFieldsChange}
            label={fieldsLabel}
          />
        </div>
      ) : null}
      {editorPanel === "map" && viewType === "map" ? (
        <MapDefaultsEditor
          center={working.mapCenter}
          zoom={working.mapZoom}
          onChange={(patch) => patchConfig(patch)}
        />
      ) : null}
    </div>
  );

  // The view tab bar (create / switch / configure shared views).
  const tabs = (
    <ViewTabs
      views={savedViews}
      activeViewId={activeViewId}
      onSelect={selectView}
      onCreate={(input) => views.create.mutate(input)}
      onRename={(id, name) => views.rename.mutate({ id, name })}
      onDelete={(id) => views.remove.mutate(id)}
      onSetDefault={(id, isDefault) => views.setDefault.mutate({ id, isDefault })}
      onReorder={(ids) => views.reorder.mutate(ids)}
      fields={viewFields}
      editor={viewEditor}
    />
  );

  // Toolbar actions kept beside the title (filters/columns now live in the view
  // editor). Host-supplied list actions + the New link remain.
  const controls = (
    <div className="flex flex-wrap items-center gap-3">
      {admin.slots.collection?.listActions?.({ slug, client: admin.client })}
      <AdminLink
        href={`${admin.basePath}/${slug}/new`}
        className="text-sm font-medium text-primary"
      >
        New
      </AdminLink>
    </div>
  );

  // Board / map / calendar views render their own header (ListView is
  // table-specific), in the same pinned-header + scrolling-body page frame.
  if (
    (viewType === "kanban" && kanbanField) ||
    (viewType === "map" && geoField) ||
    (viewType === "calendar" && calendarField)
  ) {
    return (
      <PageLayout.Root>
        <PageLayout.Header>
          <PageLayout.Title>{collection.label ?? slug}</PageLayout.Title>
          <div className="flex items-center gap-2">{controls}</div>
        </PageLayout.Header>
        <PageLayout.Body className="space-y-4">
          {tabs}
          {cappedOut ? (
            <p className="text-muted-foreground text-sm">
              Showing the first {rows.length} records. Narrow the set with a filter to see more.
            </p>
          ) : null}
          {viewType === "kanban" && kanbanField ? (
            <KanbanView.Root
              collection={collection}
              rows={rows}
              groupField={kanbanField}
              cardFields={working.cardFields}
              registry={admin.displayWidgets}
              onRowClick={openRow}
              onMove={(rowId, value) =>
                updateRow.mutate({ id: rowId, values: { [kanbanField]: value } })
              }
            />
          ) : viewType === "map" && geoField ? (
            <MapView.Root
              collection={collection}
              rows={rows}
              geoField={geoField}
              cardFields={working.cardFields}
              mapStyleUrl={admin.mapStyleUrl}
              darkStyleUrl={admin.mapDarkStyleUrl}
              defaultCenter={working.mapCenter}
              defaultZoom={working.mapZoom}
              onRowClick={openRow}
            />
          ) : viewType === "calendar" && calendarField ? (
            <CalendarView.Root
              collection={collection}
              rows={rows}
              startField={calendarField}
              endField={calendarEndField}
              cardFields={working.cardFields}
              view={calendarView}
              onViewChange={changeCalendarView}
              onRowClick={openRow}
            />
          ) : null}
        </PageLayout.Body>
      </PageLayout.Root>
    );
  }

  return (
    <ListView.Root
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
      actions={controls}
      header={tabs}
    />
  );
}

/** A disclosure button for one inline section of the "Edit view" dialog. */
function PanelToggle({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        buttonVariants({ variant: active ? "secondary" : "outline", size: "sm" }),
        "gap-1.5",
      )}
    >
      {children}
    </button>
  );
}

const COORD_INPUT_CLASS =
  "h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Edits a map view's opening camera — latitude, longitude, and zoom. A center
 * needs both coordinates to take effect; "Reset to auto-fit" clears them so the
 * map snaps to its markers again. Local string state keeps half-typed numbers
 * (a lone "-" or "12.") responsive while only finite values are committed.
 */
function MapDefaultsEditor({
  center,
  zoom,
  onChange,
}: {
  readonly center?: { readonly lat: number; readonly lng: number };
  readonly zoom?: number;
  readonly onChange: (patch: Partial<ViewConfig>) => void;
}): ReactNode {
  const [lat, setLat] = useState(center ? String(center.lat) : "");
  const [lng, setLng] = useState(center ? String(center.lng) : "");
  const [zoomText, setZoomText] = useState(zoom !== undefined ? String(zoom) : "");

  function commit(nextLat: string, nextLng: string, nextZoom: string) {
    const latNum = Number.parseFloat(nextLat);
    const lngNum = Number.parseFloat(nextLng);
    const zoomNum = Number.parseFloat(nextZoom);
    onChange({
      mapCenter:
        Number.isFinite(latNum) && Number.isFinite(lngNum)
          ? { lat: latNum, lng: lngNum }
          : undefined,
      mapZoom: Number.isFinite(zoomNum) ? zoomNum : undefined,
    });
  }

  function reset() {
    setLat("");
    setLng("");
    setZoomText("");
    onChange({ mapCenter: undefined, mapZoom: undefined });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="font-medium text-sm">Map position</p>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-muted-foreground text-xs">
          Latitude
          <input
            aria-label="Default latitude"
            type="number"
            inputMode="decimal"
            className={COORD_INPUT_CLASS}
            value={lat}
            onChange={(event) => {
              setLat(event.target.value);
              commit(event.target.value, lng, zoomText);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-muted-foreground text-xs">
          Longitude
          <input
            aria-label="Default longitude"
            type="number"
            inputMode="decimal"
            className={COORD_INPUT_CLASS}
            value={lng}
            onChange={(event) => {
              setLng(event.target.value);
              commit(lat, event.target.value, zoomText);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-muted-foreground text-xs">
          Zoom
          <input
            aria-label="Default zoom"
            type="number"
            inputMode="decimal"
            min={0}
            max={22}
            step={0.5}
            className={COORD_INPUT_CLASS}
            value={zoomText}
            onChange={(event) => {
              setZoomText(event.target.value);
              commit(lat, lng, event.target.value);
            }}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={reset}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
      >
        Reset to auto-fit
      </button>
    </div>
  );
}
