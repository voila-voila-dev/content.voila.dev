// The list screen for ANY collection: one definition serves every collection by
// reading `params.collection` against the config. Keyset pagination as an
// infinite query; the schema-driven `ListView` renders rows.
//
// Views are SHARED (the same for everyone) and Notion-style: a `ViewTabs` bar
// lists the collection's saved views — always at least a seeded, undeletable
// "Table" — and "Add view" creates more (a board/calendar/map), choosing the
// field(s) that type needs up front. The active view lives in the URL as
// `?view=<uid>` so a view is shareable by link; its `type` + `config` drive what
// renders. The visible toolbar (search · status · filters · columns/card fields
// · map position) edits the active view and writes through to the
// shared view (no separate save step); the tab's context menu keeps rename /
// default / delete. Rows select for bulk delete. Mounted by the host's fixed
// `_app.$collection.index.tsx` shim.

import { FunnelIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import type { ListFilter, SavedView, ViewConfig } from "@voila/content/client";
import type { Doc, FieldChoice, StatusFilterValue, ViewFieldChoices } from "@voila/content-ui";
import {
  CalendarView,
  ColumnEditor,
  defaultCardFields,
  FilterEditor,
  getFieldLabel,
  KanbanView,
  ListView,
  MapView,
  PageLayout,
  pageGutter,
  searchEnabled,
  singularLabel,
  ViewTabs,
} from "@voila/content-ui";
import { AlertDialog } from "@voila.dev/ui/alert-dialog";
import { Button, buttonVariants } from "@voila.dev/ui/button";
import { Input } from "@voila.dev/ui/input";
import { Popover } from "@voila.dev/ui/popover";
import { cn } from "@voila.dev/ui/utils";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAdmin } from "../context";
import { useCollectionMutations } from "../hooks/use-collection-mutations";
import { useViewMutations } from "../hooks/use-view-mutations";
import { AdminLink } from "../lib/admin-link";
import { backToHome } from "../lib/back";
import { type AnyListParams, collectionClient } from "../lib/client-access";
import { CustomScreenDispatcher } from "./custom-dispatcher";
import { SingletonScreen } from "./singleton";

// Board/map/calendar views need (nearly) all rows, not one keyset page — fetch
// the server max per page and auto-load up to this many pages (a hard cap so a
// huge collection can't load forever; a notice shows when capped).
const BOARD_PAGE_LIMIT = 100;
const BOARD_PAGE_CAP = 5;
const DEFAULT_PAGE_SIZE = 25;

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
  const loadedViewId = useRef<string | null>(null);
  if (activeView && activeView.id !== loadedViewId.current) {
    loadedViewId.current = activeView.id;
    setWorking(activeView.config);
  }

  const viewType = activeView?.type ?? "table";
  const isBoardView = viewType === "kanban" || viewType === "map" || viewType === "calendar";

  // Toolbar state that isn't part of the shared view: the search term, the
  // publish-state scope, the page size, and the row selection.
  const [searchValue, setSearchValue] = useState("");
  const [status, setStatus] = useState<StatusFilterValue>("any");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const searching =
    collection !== undefined && searchEnabled(collection.search) && searchValue.trim() !== "";

  // The fields a board/map/calendar card shows — the view's own pick, else the
  // shared defaults — so the list query fetches exactly what the cards render.
  const cardFields = useMemo<readonly string[]>(() => {
    if (!collection) return [];
    if (working.cardFields && working.cardFields.length > 0) return working.cardFields;
    const organiser =
      viewType === "kanban"
        ? [working.kanbanField]
        : viewType === "map"
          ? [working.geoField]
          : viewType === "calendar"
            ? [working.calendarField, working.calendarEndField]
            : [];
    return defaultCardFields(collection, organiser);
  }, [
    collection,
    viewType,
    working.cardFields,
    working.kanbanField,
    working.geoField,
    working.calendarField,
    working.calendarEndField,
  ]);

  // Fetch only the fields the active view renders, so the list query stays lean
  // (especially the board "load all" path). `id` always comes back server-side;
  // the title field rides along for card/row titles. `undefined` → all columns
  // (e.g. a board view whose required field isn't set yet).
  const listFields = useMemo<readonly string[] | undefined>(() => {
    if (!collection) return undefined;
    const title = collection.titleField ? [collection.titleField] : [];
    if (viewType === "kanban") {
      return working.kanbanField ? [working.kanbanField, ...cardFields, ...title] : undefined;
    }
    if (viewType === "map") {
      return working.geoField ? [working.geoField, ...cardFields, ...title] : undefined;
    }
    if (viewType === "calendar") {
      return working.calendarField
        ? [
            working.calendarField,
            ...(working.calendarEndField ? [working.calendarEndField] : []),
            ...cardFields,
            ...title,
          ]
        : undefined;
    }
    const cols =
      working.columns && working.columns.length > 0 ? working.columns : defaultColumns(collection);
    return [...new Set([...cols, ...title])];
  }, [
    collection,
    viewType,
    working.columns,
    cardFields,
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
      status,
      pageSize,
    ],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      api.list({
        ...(working.sort ? { orderBy: working.sort.field, order: working.sort.direction } : {}),
        ...(working.filters && working.filters.length > 0 ? { filters: working.filters } : {}),
        ...(listFields ? { fields: listFields } : {}),
        ...(status !== "any" ? { status } : {}),
        limit: isBoardView ? BOARD_PAGE_LIMIT : pageSize,
        // The first page also carries the scope's total, for the count line.
        ...(pageParam ? { cursor: pageParam } : { count: true }),
      } as AnyListParams),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: collection !== undefined && !searching,
  });

  // Full-text search replaces the list while a term is typed (ranked rows).
  const searchQuery = useQuery({
    queryKey: [slug, "search", searchValue.trim(), status],
    queryFn: () =>
      api.search(searchValue.trim(), {
        limit: BOARD_PAGE_LIMIT,
        ...(status !== "any" ? { status } : {}),
      }),
    enabled: searching,
  });

  // Board/map/calendar views: keep pulling pages (up to the cap) until loaded.
  const loadedPages = query.data?.pages.length ?? 0;
  useEffect(() => {
    if (!isBoardView) return;
    if (query.hasNextPage && !query.isFetchingNextPage && loadedPages < BOARD_PAGE_CAP) {
      void query.fetchNextPage();
    }
  }, [isBoardView, query.hasNextPage, query.isFetchingNextPage, loadedPages, query.fetchNextPage]);

  const { update: updateRow, removeMany } = useCollectionMutations(slug);

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

  const rows = searching
    ? (searchQuery.data?.data ?? [])
    : (query.data?.pages.flatMap((page) => page.data) ?? []);
  const total = searching ? searchQuery.data?.data.length : query.data?.pages[0]?.total;
  const visibleColumns =
    working.columns && working.columns.length > 0 ? working.columns : defaultColumns(collection);
  const label = collection.label ?? slug;
  const singular = singularLabel(collection);

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
  function rowHref(row: Doc): string {
    return `${admin.basePath}/${slug}/${row.id}`;
  }
  function openRow(row: Doc) {
    navigate({ href: rowHref(row) });
  }

  // The visible toolbar: filters always; columns on the table view, card fields
  // on a board/map/calendar; the map's default position on a map. Each is a
  // popover over the active view's config (writes through on change).
  const fieldsLabel = viewType === "table" ? "Columns" : "Card fields";
  const fieldsValue = viewType === "table" ? visibleColumns : cardFields;
  const onFieldsChange =
    viewType === "table" ? changeColumns : (next: string[]) => patchConfig({ cardFields: next });
  const filterCount = working.filters?.length ?? 0;

  const toolbar = (
    <>
      <Popover.Root>
        <Popover.Trigger
          className={cn(
            buttonVariants({ variant: filterCount > 0 ? "secondary" : "outline", size: "sm" }),
          )}
        >
          <FunnelIcon aria-hidden />
          {filterCount > 0 ? `Filters (${filterCount})` : "Filter"}
        </Popover.Trigger>
        <Popover.Content align="end" className="w-[26rem] max-w-[calc(100vw-2rem)]">
          <FilterEditor
            collection={collection}
            value={working.filters ?? []}
            onChange={changeFilters}
          />
        </Popover.Content>
      </Popover.Root>
      <Popover.Root>
        <Popover.Trigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          {fieldsLabel}
        </Popover.Trigger>
        <Popover.Content align="end" className="w-64">
          <div className="max-h-72 overflow-auto">
            <ColumnEditor
              collection={collection}
              value={fieldsValue}
              onChange={onFieldsChange}
              label={fieldsLabel}
            />
          </div>
        </Popover.Content>
      </Popover.Root>
      {viewType === "map" ? (
        <Popover.Root>
          <Popover.Trigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Map position
          </Popover.Trigger>
          <Popover.Content align="end" className="w-80">
            <MapDefaultsEditor
              center={working.mapCenter}
              zoom={working.mapZoom}
              onChange={(patch) => patchConfig(patch)}
            />
          </Popover.Content>
        </Popover.Root>
      ) : null}
    </>
  );

  // The view tab bar (create / switch / rename shared views).
  const tabs = (
    <ViewTabs
      views={savedViews}
      activeViewId={activeViewId}
      loading={viewsQuery.isLoading}
      onSelect={selectView}
      onCreate={(input) => views.create.mutate(input)}
      onRename={(id, name) => views.rename.mutate({ id, name })}
      onDelete={(id) => views.remove.mutate(id)}
      onSetDefault={(id, isDefault) => views.setDefault.mutate({ id, isDefault })}
      onReorder={(ids) => views.reorder.mutate(ids)}
      fields={viewFields}
    />
  );

  const newHref = `${admin.basePath}/${slug}/new`;
  const newButton = (
    <Button size="sm" nativeButton={false} render={<AdminLink href={newHref} />}>
      <PlusIcon aria-hidden />
      New {singular.toLowerCase()}
    </Button>
  );
  const controls = (
    <>
      {admin.slots.collection?.listActions?.({ slug, client: admin.client })}
      {newButton}
    </>
  );
  const home = backToHome(admin.basePath);
  const back = (
    <PageLayout.Back
      href={home.href}
      label={home.label}
      renderLink={(href) => <AdminLink href={href} />}
    />
  );

  // Board / map / calendar views render their own frame (ListView is
  // table-specific): the same header, the pinned tabs + toolbar, then the board
  // in the scrolling body.
  if (
    (viewType === "kanban" && kanbanField) ||
    (viewType === "map" && geoField) ||
    (viewType === "calendar" && calendarField)
  ) {
    return (
      <PageLayout.Root>
        <PageLayout.Header back={back} actions={controls}>
          <PageLayout.Title>{label}</PageLayout.Title>
        </PageLayout.Header>
        <PageLayout.Toolbar>
          <div className={pageGutter}>{tabs}</div>
          <div className={cn("flex flex-wrap items-center justify-end gap-2 py-2", pageGutter)}>
            {toolbar}
          </div>
        </PageLayout.Toolbar>
        <PageLayout.Body className="space-y-4">
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
              cardFields={cardFields}
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
              cardFields={cardFields}
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
              cardFields={cardFields}
              view={calendarView}
              onViewChange={changeCalendarView}
              onRowClick={openRow}
            />
          ) : null}
        </PageLayout.Body>
      </PageLayout.Root>
    );
  }

  const loading = searching ? searchQuery.isLoading : query.isLoading || query.isFetchingNextPage;
  const error = searching ? searchQuery.error : query.error;

  return (
    <ListView.Root
      collection={collection}
      rows={rows}
      columns={visibleColumns}
      registry={admin.displayWidgets}
      loading={loading}
      error={error instanceof Error ? error.message : undefined}
      nextCursor={!searching && query.hasNextPage ? "more" : null}
      onLoadMore={() => query.fetchNextPage()}
      total={total}
      pageSize={pageSize}
      onPageSizeChange={setPageSize}
      onRowClick={openRow}
      rowHref={rowHref}
      renderLink={(href) => <AdminLink href={href} />}
      sort={working.sort}
      onSortChange={changeSort}
      back={back}
      actions={controls}
      header={tabs}
      toolbar={toolbar}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      status={status}
      onStatusChange={setStatus}
      emptyAction={admin.slots.collection?.emptyState?.({ slug, collection }) ?? newButton}
      selectable
      selected={selected}
      onSelectedChange={setSelected}
      bulkActions={(ids) => (
        <BulkDelete
          count={ids.size}
          pending={removeMany.isPending}
          onConfirm={() => removeMany.mutate([...ids], { onSuccess: () => setSelected(new Set()) })}
        />
      )}
    />
  );
}

/** The selection bar's Delete, behind a confirm dialog. */
function BulkDelete({
  count,
  pending,
  onConfirm,
}: {
  readonly count: number;
  readonly pending: boolean;
  readonly onConfirm: () => void;
}): ReactNode {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        disabled={pending}
        className={cn(buttonVariants({ variant: "destructive", size: "xs" }))}
      >
        <TrashIcon aria-hidden />
        {pending ? "Deleting…" : `Delete ${count}`}
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>
            Delete {count} {count === 1 ? "record" : "records"}?
          </AlertDialog.Title>
          <AlertDialog.Description>
            It's a soft delete — the records are hidden but recoverable through the API.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

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
  const id = useId();

  function commit(nextLat: string, nextLng: string, nextZoom: string) {
    const latNum = Number.parseFloat(nextLat.replace(",", "."));
    const lngNum = Number.parseFloat(nextLng.replace(",", "."));
    const zoomNum = Number.parseFloat(nextZoom.replace(",", "."));
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
    <div className="space-y-3">
      <p className="font-medium text-sm">Map position</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1 text-muted-foreground text-xs">
          <label htmlFor={`${id}-lat`}>Latitude</label>
          <Input
            id={`${id}-lat`}
            type="text"
            inputMode="decimal"
            value={lat}
            onChange={(event) => {
              setLat(event.target.value);
              commit(event.target.value, lng, zoomText);
            }}
          />
        </div>
        <div className="flex flex-col gap-1 text-muted-foreground text-xs">
          <label htmlFor={`${id}-lng`}>Longitude</label>
          <Input
            id={`${id}-lng`}
            type="text"
            inputMode="decimal"
            value={lng}
            onChange={(event) => {
              setLng(event.target.value);
              commit(lat, event.target.value, zoomText);
            }}
          />
        </div>
        <div className="flex flex-col gap-1 text-muted-foreground text-xs">
          <label htmlFor={`${id}-zoom`}>Zoom</label>
          <Input
            id={`${id}-zoom`}
            type="text"
            inputMode="decimal"
            value={zoomText}
            onChange={(event) => {
              setZoomText(event.target.value);
              commit(lat, lng, event.target.value);
            }}
          />
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={reset}>
        Reset to auto-fit
      </Button>
    </div>
  );
}
