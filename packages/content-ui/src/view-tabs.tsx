// ViewTabs — a Notion-style row of saved-view tabs plus an "Add view" creator.
// Views are shared, so every tab is the same for everyone; clicking one switches
// the active view (the host reflects it in the URL). "+ Add view" opens a dialog
// to name a view, pick its type, and choose the field(s) that type needs (a
// kanban group field, a calendar start/end field, a map geo field). Right-click
// any tab for a context menu to rename, set-as-default, or delete it (the seeded
// default Table view can't be deleted). Purely presentational and
// callback-driven: the host owns persistence through the typed client.

import type { ViewConfig, ViewType } from "@voila/content/client";
import { buttonVariants } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import { ContextMenu } from "@voila/ui/context-menu";
import { Dialog } from "@voila/ui/dialog";
import { Input } from "@voila/ui/input";
import { type ReactNode, useState } from "react";
import type { FieldChoice } from "./view-switcher";

const SELECT_CLASS = cn(
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
);

const TYPE_LABELS: Record<ViewType, string> = {
  table: "Table",
  kanban: "Board",
  calendar: "Calendar",
  map: "Map",
};

/** A saved view, reduced to what the tab bar needs. */
export interface ViewTabItem {
  readonly id: string;
  readonly name: string;
  readonly type: ViewType;
  /** The seeded default Table view — can't be deleted. */
  readonly seeded: boolean;
  /** The collection's default view (loads first). */
  readonly isDefault: boolean;
}

/** Field candidates each view type can be configured with. */
export interface ViewFieldChoices {
  readonly kanban: ReadonlyArray<FieldChoice>;
  readonly geo: ReadonlyArray<FieldChoice>;
  readonly date: ReadonlyArray<FieldChoice>;
}

export interface ViewTabsProps {
  readonly views: ReadonlyArray<ViewTabItem>;
  readonly activeViewId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onCreate: (input: { name: string; type: ViewType; config: ViewConfig }) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onSetDefault: (id: string, isDefault: boolean) => void;
  /** Persist a drag-reordered tab order (the complete ordered list of view ids). */
  readonly onReorder: (ids: string[]) => void;
  readonly fields: ViewFieldChoices;
  /** Per-view editor controls (filters / columns) shown in the edit dialog. The
   *  host binds these to the *active* view's config, so opening the editor also
   *  selects the view being edited. */
  readonly editor?: ReactNode;
}

/**
 * Move `from` to sit where `to` currently is within the ordered id list (insert
 * before `to`). A no-op when either id is missing or they're equal — so a stray
 * drop never drops or duplicates a tab.
 */
export function reorderIds(ids: readonly string[], from: string, to: string): string[] {
  if (from === to) return [...ids];
  const without = ids.filter((id) => id !== from);
  const targetIdx = without.indexOf(to);
  if (targetIdx < 0 || !ids.includes(from)) return [...ids];
  without.splice(targetIdx, 0, from);
  return without;
}

/** The view types the collection can offer, given which fields it has. */
function availableTypes(fields: ViewFieldChoices): ViewType[] {
  return [
    "table",
    ...(fields.kanban.length > 0 ? (["kanban"] as const) : []),
    ...(fields.date.length > 0 ? (["calendar"] as const) : []),
    ...(fields.geo.length > 0 ? (["map"] as const) : []),
  ];
}

/** A labelled native `<select>` for the create dialog's field pickers. */
function Picker({
  label,
  value,
  options,
  onChange,
  emptyLabel,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: ReadonlyArray<FieldChoice>;
  readonly onChange: (value: string) => void;
  readonly emptyLabel?: string;
}): ReactNode {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        aria-label={label}
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {emptyLabel !== undefined ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The "Add view" dialog body: name, type, and the type's required field(s). */
function CreateViewForm({
  fields,
  onCreate,
  onDone,
}: {
  readonly fields: ViewFieldChoices;
  readonly onCreate: ViewTabsProps["onCreate"];
  readonly onDone: () => void;
}): ReactNode {
  const types = availableTypes(fields);
  const [name, setName] = useState("");
  const [type, setType] = useState<ViewType>("table");
  const [kanbanField, setKanbanField] = useState(fields.kanban[0]?.value ?? "");
  const [geoField, setGeoField] = useState(fields.geo[0]?.value ?? "");
  const [calendarField, setCalendarField] = useState(fields.date[0]?.value ?? "");
  const [calendarEndField, setCalendarEndField] = useState("");

  // A type is only submittable once its required field is chosen.
  const ready =
    name.trim() !== "" &&
    (type !== "kanban" || kanbanField !== "") &&
    (type !== "map" || geoField !== "") &&
    (type !== "calendar" || calendarField !== "");

  function submit() {
    if (!ready) return;
    const config: ViewConfig =
      type === "kanban"
        ? { kanbanField }
        : type === "map"
          ? { geoField }
          : type === "calendar"
            ? { calendarField, ...(calendarEndField ? { calendarEndField } : {}) }
            : {};
    onCreate({ name: name.trim(), type, config });
    onDone();
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Input
        aria-label="View name"
        placeholder="View name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Type</span>
        <select
          aria-label="View type"
          className={SELECT_CLASS}
          value={type}
          onChange={(event) => setType(event.target.value as ViewType)}
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      {type === "kanban" ? (
        <Picker
          label="Group by"
          value={kanbanField}
          options={fields.kanban}
          onChange={setKanbanField}
        />
      ) : null}
      {type === "map" ? (
        <Picker label="Plot" value={geoField} options={fields.geo} onChange={setGeoField} />
      ) : null}
      {type === "calendar" ? (
        <>
          <Picker
            label="Start"
            value={calendarField}
            options={fields.date}
            onChange={setCalendarField}
          />
          <Picker
            label="End"
            value={calendarEndField}
            options={fields.date}
            onChange={setCalendarEndField}
            emptyLabel="No end"
          />
        </>
      ) : null}

      <Dialog.Footer>
        <Dialog.Close className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Cancel
        </Dialog.Close>
        <button type="submit" disabled={!ready} className={cn(buttonVariants({ size: "sm" }))}>
          Create view
        </button>
      </Dialog.Footer>
    </form>
  );
}

export function ViewTabs({
  views,
  activeViewId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onSetDefault,
  onReorder,
  fields,
  editor,
}: ViewTabsProps): ReactNode {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ViewTabItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Transient drag state: the id being dragged + the id it's hovering, for the
  // visual cues. The reorder reads the source from the drag's dataTransfer, so
  // it stays correct even if a render lags the cursor.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function dropOn(targetId: string, source: string | null) {
    setDragId(null);
    setOverId(null);
    if (!source || source === targetId) return;
    onReorder(
      reorderIds(
        views.map((v) => v.id),
        source,
        targetId,
      ),
    );
  }

  function openEdit(view: ViewTabItem) {
    // Editing filters/columns acts on the active view, so select it first; the
    // host's `editor` then reflects the view being edited.
    onSelect(view.id);
    setEditing(view);
    setRenameValue(view.name);
  }

  function submitRename() {
    if (editing === null) return;
    const trimmed = renameValue.trim();
    if (trimmed !== "" && trimmed !== editing.name) onRename(editing.id, trimmed);
    setEditing(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b">
      {views.map((view) => {
        const active = view.id === activeViewId;
        return (
          <ContextMenu.Root key={view.id}>
            <ContextMenu.Trigger
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/plain", view.id);
                event.dataTransfer.effectAllowed = "move";
                setDragId(view.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (overId !== view.id) setOverId(view.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                dropOn(view.id, event.dataTransfer.getData("text/plain") || dragId);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={cn(
                "-mb-px flex cursor-grab items-center border-b-2 px-1",
                active ? "border-primary" : "border-transparent",
                dragId === view.id && "opacity-50",
                overId === view.id && dragId !== view.id && "bg-accent",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(view.id)}
                className={cn(
                  "rounded-md px-2 py-1.5 font-medium text-sm",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {view.isDefault ? "★ " : ""}
                {view.name}
              </button>
            </ContextMenu.Trigger>
            <ContextMenu.Content>
              <ContextMenu.Item onClick={() => openEdit(view)}>Edit view</ContextMenu.Item>
              <ContextMenu.Item onClick={() => onSetDefault(view.id, !view.isDefault)}>
                {view.isDefault ? "Remove default" : "Set as default"}
              </ContextMenu.Item>
              {view.seeded ? null : (
                <>
                  <ContextMenu.Separator />
                  <ContextMenu.Item
                    className="text-destructive data-[highlighted]:text-destructive"
                    onClick={() => onDelete(view.id)}
                  >
                    Delete
                  </ContextMenu.Item>
                </>
              )}
            </ContextMenu.Content>
          </ContextMenu.Root>
        );
      })}

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Trigger
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
        >
          + Add view
        </Dialog.Trigger>
        <Dialog.Content className="max-w-sm">
          <Dialog.Header>
            <Dialog.Title>Add view</Dialog.Title>
            <Dialog.Description>
              Create a shared view — it's the same for everyone.
            </Dialog.Description>
          </Dialog.Header>
          <CreateViewForm fields={fields} onCreate={onCreate} onDone={() => setCreateOpen(false)} />
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <Dialog.Content className="max-h-[85vh] max-w-sm overflow-y-auto">
          <Dialog.Header>
            <Dialog.Title>Edit view</Dialog.Title>
            <Dialog.Description>
              Rename this view and tune its filters and columns.
            </Dialog.Description>
          </Dialog.Header>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
          >
            <Input
              aria-label="View name"
              placeholder="View name"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
            />
            {editor}
            <Dialog.Footer>
              <Dialog.Close className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Cancel
              </Dialog.Close>
              <button type="submit" className={cn(buttonVariants({ size: "sm" }))}>
                Save
              </button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Root>
    </div>
  );
}
