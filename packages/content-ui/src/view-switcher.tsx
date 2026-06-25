// ViewSwitcher — the list page's view controls: a table/kanban/map segmented
// control, a saved-view selector, and Save / Save-as / Delete actions. Purely
// presentational and callback-driven: the host owns the active view + the
// working config and persists through the typed client's `views` sub-API. The
// view types offered can be narrowed (e.g. drop "Map" for a collection with no
// geo field) via `availableTypes`.

import { Button, buttonVariants } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import { Dialog } from "@voila/ui/dialog";
import { Input } from "@voila/ui/input";
import { Tabs } from "@voila/ui/tabs";
import { type ReactNode, useState } from "react";

export type ViewType = "table" | "kanban" | "map";

const VIEW_TYPE_LABELS: ReadonlyArray<{ readonly value: ViewType; readonly label: string }> = [
  { value: "table", label: "Table" },
  { value: "kanban", label: "Kanban" },
  { value: "map", label: "Map" },
];

// Shared chrome for the inline `<select>`s (saved view + field pickers).
const SELECT_CLASS = cn(
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
);

/** A saved view, reduced to what the switcher needs to list it. */
export interface ViewOption {
  readonly id: string;
  readonly name: string;
}

/** A field a kanban/map view can use, with its display label. */
export interface FieldChoice {
  readonly value: string;
  readonly label: string;
}

/** A labeled inline `<select>` for picking the kanban/map field. */
function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: ReadonlyArray<FieldChoice>;
  readonly onChange: (value: string) => void;
}): ReactNode {
  return (
    <label className="flex items-center gap-1.5 text-muted-foreground text-sm">
      {label}
      <select
        aria-label={label}
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface ViewSwitcherProps {
  readonly viewType: ViewType;
  readonly onViewTypeChange: (type: ViewType) => void;
  /** The user's saved views for the collection. */
  readonly views: ReadonlyArray<ViewOption>;
  /** The active saved view's id, or `null` for the unsaved/default view. */
  readonly activeViewId?: string | null;
  /** Called when a saved view is selected (only the selector — present with views). */
  readonly onSelectView?: (id: string | null) => void;
  /** Save the working config back onto the active view (enabled when `dirty`). */
  readonly onSave?: () => void;
  /** Save the working config as a new named view. */
  readonly onSaveAs: (name: string) => void;
  /** Delete the active view. */
  readonly onDelete?: () => void;
  /** Whether the working config differs from the active view (enables Save). */
  readonly dirty?: boolean;
  /** Restrict the offered view types (e.g. omit "map" without a geo field). */
  readonly availableTypes?: ReadonlyArray<ViewType>;
  /** Enum/select fields a kanban board can group by (shown when ≥2 in kanban). */
  readonly kanbanFields?: ReadonlyArray<FieldChoice>;
  /** The field the kanban currently groups by. */
  readonly kanbanField?: string;
  /** Pick the kanban group field. */
  readonly onKanbanFieldChange?: (value: string) => void;
  /** Geo fields a map can plot (shown when ≥2 in map view). */
  readonly geoFields?: ReadonlyArray<FieldChoice>;
  /** The geo field the map currently plots. */
  readonly geoField?: string;
  /** Pick the map's geo field. */
  readonly onGeoFieldChange?: (value: string) => void;
  /** Whether the active view is the user's default for this collection. */
  readonly activeIsDefault?: boolean;
  /** Make the active view the default (or clear it). Enables the default toggle. */
  readonly onSetDefault?: (isDefault: boolean) => void;
  /** Rename the active view. Enables the Rename action. */
  readonly onRename?: (name: string) => void;
}

export function ViewSwitcher({
  viewType,
  onViewTypeChange,
  views,
  activeViewId = null,
  onSelectView,
  onSave,
  onSaveAs,
  onDelete,
  dirty = false,
  availableTypes,
  kanbanFields,
  kanbanField,
  onKanbanFieldChange,
  geoFields,
  geoField,
  onGeoFieldChange,
  activeIsDefault = false,
  onSetDefault,
  onRename,
}: ViewSwitcherProps): ReactNode {
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [name, setName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState("");
  const types = VIEW_TYPE_LABELS.filter((t) => !availableTypes || availableTypes.includes(t.value));
  const activeName = views.find((view) => view.id === activeViewId)?.name ?? "";
  // Offer a field picker only when there's a genuine choice (≥2 candidates) —
  // with one field the auto-pick already names it.
  const showKanbanField =
    viewType === "kanban" && onKanbanFieldChange && (kanbanFields?.length ?? 0) > 1;
  const showGeoField = viewType === "map" && onGeoFieldChange && (geoFields?.length ?? 0) > 1;

  function submitSaveAs() {
    const trimmed = name.trim();
    if (trimmed === "") return;
    onSaveAs(trimmed);
    setName("");
    setSaveAsOpen(false);
  }

  function openRename() {
    setRenameName(activeName);
    setRenameOpen(true);
  }

  function submitRename() {
    const trimmed = renameName.trim();
    if (trimmed === "" || trimmed === activeName) return setRenameOpen(false);
    onRename?.(trimmed);
    setRenameOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs.Root value={viewType} onValueChange={(value) => onViewTypeChange(value as ViewType)}>
        <Tabs.List>
          {types.map((type) => (
            <Tabs.Trigger key={type.value} value={type.value}>
              {type.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>

      {showKanbanField && kanbanFields ? (
        <FieldSelect
          label="Group by"
          value={kanbanField ?? ""}
          options={kanbanFields}
          onChange={onKanbanFieldChange}
        />
      ) : null}

      {showGeoField && geoFields ? (
        <FieldSelect
          label="Plot"
          value={geoField ?? ""}
          options={geoFields}
          onChange={onGeoFieldChange}
        />
      ) : null}

      {views.length > 0 ? (
        <select
          aria-label="Saved view"
          className={SELECT_CLASS}
          value={activeViewId ?? ""}
          onChange={(event) =>
            onSelectView?.(event.target.value === "" ? null : event.target.value)
          }
        >
          <option value="">Default view</option>
          {views.map((view) => (
            <option key={view.id} value={view.id}>
              {view.name}
            </option>
          ))}
        </select>
      ) : null}

      {activeViewId !== null && onSave ? (
        <Button variant="outline" size="sm" disabled={!dirty} onClick={onSave}>
          Save
        </Button>
      ) : null}

      <Dialog.Root open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <Dialog.Trigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Save as…
        </Dialog.Trigger>
        <Dialog.Content className="max-w-sm">
          <Dialog.Header>
            <Dialog.Title>Save view</Dialog.Title>
            <Dialog.Description>
              Save the current columns, sort and filters as a named view.
            </Dialog.Description>
          </Dialog.Header>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitSaveAs();
            }}
          >
            <Input
              aria-label="View name"
              placeholder="View name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Dialog.Footer>
              <Dialog.Close className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={name.trim() === ""}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Save
              </button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {activeViewId !== null && onSetDefault ? (
        <Button
          variant={activeIsDefault ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={activeIsDefault}
          onClick={() => onSetDefault(!activeIsDefault)}
        >
          {activeIsDefault ? "★ Default" : "Set as default"}
        </Button>
      ) : null}

      {activeViewId !== null && onRename ? (
        <Button variant="ghost" size="sm" onClick={openRename}>
          Rename
        </Button>
      ) : null}

      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Content className="max-w-sm">
          <Dialog.Header>
            <Dialog.Title>Rename view</Dialog.Title>
            <Dialog.Description>Give this saved view a new name.</Dialog.Description>
          </Dialog.Header>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
          >
            <Input
              aria-label="New view name"
              placeholder="View name"
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
            />
            <Dialog.Footer>
              <Dialog.Close className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={renameName.trim() === ""}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Save
              </button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      {activeViewId !== null && onDelete ? (
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}
