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
// · map position · density) edits the active view and writes through to the
// shared view (no separate save step); the tab's context menu keeps rename /
// default / delete. Rows select for bulk delete. Mounted by the host's fixed
// `_app.$collection.index.tsx` shim.

import {
  CopyIcon,
  DotsThreeIcon,
  DownloadSimpleIcon,
  FunnelIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import type { Collection } from "@voila/content";
import type { ListFilter, SavedView, ViewConfig } from "@voila/content/client";
import type { Doc, FieldChoice, StatusFilterValue, ViewFieldChoices } from "@voila/content-ui";
import {
  CalendarView,
  ColumnEditor,
  collectionOperations,
  defaultCardFields,
  documentTitle,
  FilterEditor,
  getFieldLabel,
  KanbanView,
  ListView,
  MapView,
  PageLayout,
  pageGutter,
  searchEnabled,
  singularLabel,
  useI18n,
  useMessages,
  ViewTabs,
} from "@voila/content-ui";
import { AlertDialog } from "@voila.dev/ui/alert-dialog";
import { Button, buttonVariants } from "@voila.dev/ui/button";
import { DropdownMenu } from "@voila.dev/ui/dropdown-menu";
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
import { buildCsv, csvFilename, downloadCsv } from "../lib/export-csv";
import { CustomScreenDispatcher } from "./custom-dispatcher";
import { SingletonScreen } from "./singleton";

// Board/map/calendar views need (nearly) all rows, not one keyset page — fetch
// the server max per page and auto-load up to this many pages (a hard cap so a
// huge collection can't load forever; a notice shows when capped).
const BOARD_PAGE_LIMIT = 100;
const BOARD_PAGE_CAP = 5;
const DEFAULT_PAGE_SIZE = 25;

/** The collection's non-hidden field keys — the default visible columns. */
/**
 * Field kinds that make a poor default column. Long-form and binary values turn
 * a table into a wall of truncated text — a row of "Lisbon rewards walkers who
 * don't mind h…" tells an editor nothing they can scan. They stay one click
 * away in the column picker, and any saved view that names them still shows them.
 */
const NOISY_COLUMN_KINDS = new Set([
  "richText",
  "markdown",
  "code",
  "json",
  "media",
  "object",
  "array",
  "blocks",
]);

/** How many columns a table opens with before the picker takes over. */
const DEFAULT_COLUMN_BUDGET = 8;

/**
 * The columns a collection's table opens with. Previously this was "every
 * non-hidden field", which put a truncated rich-text body and a column of
 * em-dashes in front of the title. Now it leads with the title, drops the kinds
 * that can't be read at a glance, and stops at a budget so the first screen is
 * scannable without horizontal scrolling.
 */
function defaultColumns(collection: Collection): string[] {
  const keys = Object.keys(collection.fields).filter((k) => !collection.fields[k]?.meta.hidden);
  const title = collection.titleField;
  const scannable = keys.filter((k) => {
    const kind = collection.fields[k]?.meta.kind;
    return kind === undefined || !NOISY_COLUMN_KINDS.has(kind);
  });
  // The title always leads, whether or not it survived the kind filter.
  const ordered =
    title !== undefined && keys.includes(title)
      ? [title, ...scannable.filter((k) => k !== title)]
      : scannable;
  // A collection made entirely of long-form fields still needs columns.
  return (ordered.length > 0 ? ordered : keys).slice(0, DEFAULT_COLUMN_BUDGET);
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

/**
 * The field a calendar colours its events by, chosen without configuration: an
 * editor-picked `color` field first, else the same select/enum a board would
 * group by. Colouring by SOMETHING beats a month of identical grey blocks, and
 * the choice is the one dimension the collection already treats as categorical.
 */
function calendarColorField(collection: Collection): string | undefined {
  const color = Object.keys(collection.fields).find(
    (k) => collection.fields[k]?.meta.kind === "color",
  );
  if (color !== undefined) return color;
  return kanbanFields(collection)[0];
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
  // The same box drives a client-side title filter when there is no index.
  const titleFilter =
    collection !== undefined && !searchEnabled(collection.search)
      ? searchValue.trim().toLowerCase()
      : "";

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

  const { create, update: updateRow, removeMany, updateMany } = useCollectionMutations(slug);
  const i18n = useI18n();
  const { admin: m, common } = useMessages();

  /**
   * Copy a record into a new draft. Server-owned columns are stripped (a new id
   * is minted, timestamps are the server's), and the title/slug are suffixed so
   * the copy is distinguishable in the list and doesn't collide on a unique
   * slug. Lands the editor in the new record so the duplicate is immediately
   * editable rather than silently appearing somewhere in the list.
   */
  function duplicateRow(row: Doc): void {
    const collection = admin.config.collections[slug] as Collection | undefined;
    if (!collection) return;
    const copy: Doc = {};
    for (const key of Object.keys(collection.fields)) {
      if (!(key in row)) continue;
      const field = collection.fields[key];
      const value = row[key];
      if (value === undefined || value === null) continue;
      if (key === collection.titleField) {
        copy[key] = suffixTitle(value, m.copySuffix);
      } else if (field?.meta.kind === "slug" && typeof value === "string") {
        copy[key] = `${value}-copy`;
      } else {
        copy[key] = value;
      }
    }
    create.mutate(copy, {
      onSuccess: (doc) => navigate({ href: `${admin.basePath}/${slug}/${String(doc.id)}` }),
    });
  }

  function selectView(id: string) {
    // `as never`: the host's registered router types its own search params
    // (a site route may declare `{ ville?: string }`); the admin only adds `view`.
    navigate({
      to: ".",
      search: ((prev: Record<string, unknown>) => ({ ...prev, view: id })) as never,
    });
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

  const loadedRows = searching
    ? (searchQuery.data?.data ?? [])
    : (query.data?.pages.flatMap((page) => page.data) ?? []);
  // Collections without a full-text index still get a working search box: the
  // term narrows the rows already loaded by title. It is honestly scoped —
  // the empty state says "no LOADED record matches" — and it beats offering
  // nothing at all on a collection an editor is trying to find something in.
  const rows =
    !searching && titleFilter !== ""
      ? loadedRows.filter((row) =>
          (documentTitle(collection, row, i18n) ?? "").toLowerCase().includes(titleFilter),
        )
      : loadedRows;
  const total = searching
    ? searchQuery.data?.data.length
    : titleFilter !== ""
      ? rows.length
      : query.data?.pages[0]?.total;
  const visibleColumns =
    working.columns && working.columns.length > 0 ? working.columns : defaultColumns(collection);
  const label = collection.label ?? slug;
  const singular = singularLabel(collection);
  // Which write affordances to offer at all (a read-mostly external collection
  // may turn some off); the REST layer refuses the same operations with a 405.
  const ops = collectionOperations(collection);

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
  const fieldsLabel = viewType === "table" ? m.columns : m.cardFields;
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
          {filterCount > 0 ? m.filters(filterCount) : m.filter}
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
            {m.mapPosition}
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
  const newButton = ops.create ? (
    <Button size="sm" nativeButton={false} render={<AdminLink href={newHref} />}>
      <PlusIcon aria-hidden />
      {common.newItem(singular.toLowerCase())}
    </Button>
  ) : null;
  const controls = (
    <>
      {admin.slots.collection?.listActions?.({ slug, client: admin.client })}
      {newButton}
    </>
  );
  const home = backToHome(admin.basePath, m);
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
            <p className="text-muted-foreground text-sm">{m.showingFirst(rows.length)}</p>
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
              // Fill the page panel instead of the standalone 60vh strip, which
              // left the bottom half of a desktop screen empty. The subtraction
              // is the shell chrome above it (header + view tabs + toolbar);
              // `min-h` keeps it usable on a short window.
              className="h-[calc(100svh-14rem)] min-h-96"
            />
          ) : viewType === "calendar" && calendarField ? (
            <CalendarView.Root
              collection={collection}
              rows={rows}
              startField={calendarField}
              endField={calendarEndField}
              cardFields={cardFields}
              colorField={calendarColorField(collection)}
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
      // Selection exists for the bulk actions (set a field, delete); a
      // collection that offers no write at all has nothing to select rows FOR.
      selectable={ops.create || ops.update || ops.delete}
      selected={selected}
      onSelectedChange={setSelected}
      rowActions={
        ops.create || ops.delete
          ? (row) => (
              <RowActions
                singular={singular.toLowerCase()}
                onDuplicate={ops.create ? () => duplicateRow(row) : undefined}
                onDelete={
                  ops.delete
                    ? () => removeMany.mutate([String((row as { id?: unknown }).id)])
                    : undefined
                }
              />
            )
          : undefined
      }
      bulkActions={(ids) => (
        <BulkActions
          ids={ids}
          collection={collection}
          rows={rows}
          defaultLocale={admin.config.i18n?.defaultLocale}
          slug={slug}
          canUpdate={ops.update}
          canDelete={ops.delete}
          deleting={removeMany.isPending}
          applying={updateMany.isPending}
          onSetField={(values, label) =>
            updateMany.mutate(
              { ids: [...ids], values, label },
              { onSuccess: () => setSelected(new Set()) },
            )
          }
          onDelete={() => removeMany.mutate([...ids], { onSuccess: () => setSelected(new Set()) })}
        />
      )}
    />
  );
}

/** Append a suffix to a title, whether it is plain or a per-locale record. */
function suffixTitle(value: unknown, suffix: string): unknown {
  if (typeof value === "string") return `${value}${suffix}`;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [locale, text] of Object.entries(value as Record<string, unknown>)) {
      out[locale] = typeof text === "string" ? `${text}${suffix}` : text;
    }
    return out;
  }
  return value;
}

/**
 * The per-row overflow menu, revealed on hover. Duplicate and Delete are the
 * two things an editor wants from a list row without opening the record; Open
 * is already the row itself. Either handler may be absent when the collection
 * turns that operation off (`operations.create` / `operations.delete`) — the
 * caller omits the whole menu when both are.
 */
function RowActions({
  singular,
  onDuplicate,
  onDelete,
}: {
  readonly singular: string;
  readonly onDuplicate?: () => void;
  readonly onDelete?: () => void;
}): ReactNode {
  const { admin: m, common } = useMessages();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={m.rowActions(singular)}
            // The row is a click target; this menu is not a way into it.
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <DotsThreeIcon weight="bold" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {onDuplicate ? (
          <DropdownMenu.Item onClick={onDuplicate}>
            <CopyIcon aria-hidden />
            {m.duplicate}
          </DropdownMenu.Item>
        ) : null}
        {onDelete ? (
          <DropdownMenu.Item variant="destructive" onClick={onDelete}>
            <TrashIcon aria-hidden />
            {common.delete}
          </DropdownMenu.Item>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

/**
 * Everything the selection bar can do to the checked rows. Checking rows used
 * to offer only Delete, which made selection nearly pointless — the reasons an
 * editor selects several records at once are almost always "move these to the
 * same status" or "get these into a spreadsheet".
 *
 * The status menu is derived, not hard-coded: any `enum` field on the
 * collection becomes a "Set <field>" submenu, so a collection with
 * `status: Draft/On sale/Cancelled` gets exactly those actions with no config.
 */
function BulkActions({
  ids,
  collection,
  rows,
  defaultLocale,
  slug,
  canUpdate,
  canDelete,
  deleting,
  applying,
  onSetField,
  onDelete,
}: {
  readonly ids: ReadonlySet<string>;
  readonly collection: Collection;
  readonly rows: ReadonlyArray<Doc>;
  readonly defaultLocale?: string;
  readonly slug: string;
  /** `operations.update` — gates the "Set <field>" menus. */
  readonly canUpdate: boolean;
  /** `operations.delete` — gates the Delete button. */
  readonly canDelete: boolean;
  readonly deleting: boolean;
  readonly applying: boolean;
  readonly onSetField: (values: Doc, label: string) => void;
  readonly onDelete: () => void;
}): ReactNode {
  const count = ids.size;
  const m = useMessages().admin;
  // Enum fields are the ones with a closed, human-labelled value set, which is
  // exactly what a bulk "move to…" needs. None when updates are off.
  const enumFields = canUpdate
    ? Object.entries(collection.fields).filter(([, field]) => field.meta.kind === "enum")
    : [];

  function exportSelected() {
    const selectedRows = rows.filter((row) => ids.has(String((row as { id?: unknown }).id)));
    const csv = buildCsv(selectedRows as ReadonlyArray<Record<string, unknown>>, {
      collection,
      defaultLocale,
    });
    downloadCsv(csv, csvFilename(slug));
  }

  return (
    <>
      {enumFields.map(([name, field]) => {
        const values = (field.meta as { values?: Record<string, string | number> }).values ?? {};
        const entries = Object.entries(values);
        if (entries.length === 0) return null;
        return (
          <DropdownMenu.Root key={name}>
            <DropdownMenu.Trigger
              disabled={applying}
              className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
            >
              {m.setField(humanizeFieldName(name))}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              {entries.map(([label, raw]) => (
                <DropdownMenu.Item
                  key={label}
                  onClick={() =>
                    onSetField({ [name]: raw } as Doc, m.setFieldTo(humanizeFieldName(name), label))
                  }
                >
                  {label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        );
      })}
      <Button variant="outline" size="xs" onClick={exportSelected}>
        <DownloadSimpleIcon aria-hidden />
        {m.exportCsv}
      </Button>
      {canDelete ? <BulkDelete count={count} pending={deleting} onConfirm={onDelete} /> : null}
    </>
  );
}

/** `publishedAt` → "Published at" — the same shape the field labels use. */
function humanizeFieldName(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return (spaced.charAt(0).toUpperCase() + spaced.slice(1)).toLowerCase();
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
  const { admin: m, common } = useMessages();
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger
        disabled={pending}
        className={cn(buttonVariants({ variant: "destructive", size: "xs" }))}
      >
        <TrashIcon aria-hidden />
        {pending ? common.deleting : m.deleteCount(count)}
      </AlertDialog.Trigger>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>{m.deleteCountTitle(count)}</AlertDialog.Title>
          <AlertDialog.Description>{m.bulkDeleteDescription}</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>{common.cancel}</AlertDialog.Cancel>
          <AlertDialog.Action variant="destructive" onClick={onConfirm}>
            {common.delete}
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
  const m = useMessages().admin;

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
      <p className="font-medium text-sm">{m.mapPosition}</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1 text-muted-foreground text-xs">
          <label htmlFor={`${id}-lat`}>{m.latitude}</label>
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
          <label htmlFor={`${id}-lng`}>{m.longitude}</label>
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
          <label htmlFor={`${id}-zoom`}>{m.zoom}</label>
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
        {m.resetAutoFit}
      </Button>
    </div>
  );
}
