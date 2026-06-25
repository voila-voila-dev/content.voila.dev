import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ViewSwitcher } from "./view-switcher";

afterEach(cleanup);

const views = [
  { id: "v1", name: "Recent" },
  { id: "v2", name: "Archived" },
];

describe("ViewSwitcher", () => {
  test("renders a tab per view type, narrowed by availableTypes", () => {
    render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={[]}
        onSaveAs={() => {}}
        availableTypes={["table", "kanban"]}
      />,
    );
    expect(screen.getByRole("tab", { name: "Table" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Kanban" })).toBeDefined();
    expect(screen.queryByRole("tab", { name: "Map" })).toBeNull();
  });

  test("changing the view type fires onViewTypeChange", () => {
    const onViewTypeChange = mock();
    render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={onViewTypeChange}
        views={[]}
        onSaveAs={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Kanban" }));
    expect(onViewTypeChange).toHaveBeenCalledWith("kanban");
  });

  test("selecting a saved view fires onSelectView with its id (or null for default)", () => {
    const onSelectView = mock();
    render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        onSelectView={onSelectView}
        onSaveAs={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Saved view"), { target: { value: "v2" } });
    expect(onSelectView).toHaveBeenCalledWith("v2");
    fireEvent.change(screen.getByLabelText("Saved view"), { target: { value: "" } });
    expect(onSelectView).toHaveBeenCalledWith(null);
  });

  test("Save is shown for an active view and gated on dirty", () => {
    const onSave = mock();
    const { rerender } = render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        activeViewId="v1"
        onSelectView={() => {}}
        onSave={onSave}
        onSaveAs={() => {}}
        dirty={false}
      />,
    );
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        activeViewId="v1"
        onSelectView={() => {}}
        onSave={onSave}
        onSaveAs={() => {}}
        dirty
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("Save as… opens a dialog and submits the typed name", () => {
    const onSaveAs = mock();
    render(
      <ViewSwitcher viewType="table" onViewTypeChange={() => {}} views={[]} onSaveAs={onSaveAs} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save as…" }));
    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "My View" } });
    // The dialog's submit button (the trigger shares the visible-name "Save as…").
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveAs).toHaveBeenCalledWith("My View");
  });

  test("delete fires onDelete for the active view", () => {
    const onDelete = mock();
    render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        activeViewId="v1"
        onSelectView={() => {}}
        onSaveAs={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  const kanbanFields = [
    { value: "status", label: "Status" },
    { value: "stage", label: "Stage" },
  ];

  test("kanban view offers a group-by field picker when there are ≥2 candidates", () => {
    const onKanbanFieldChange = mock();
    const { rerender } = render(
      <ViewSwitcher
        viewType="kanban"
        onViewTypeChange={() => {}}
        views={[]}
        onSaveAs={() => {}}
        kanbanFields={kanbanFields}
        kanbanField="status"
        onKanbanFieldChange={onKanbanFieldChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Group by"), { target: { value: "stage" } });
    expect(onKanbanFieldChange).toHaveBeenCalledWith("stage");

    // Hidden in the table view, and hidden with a single candidate.
    rerender(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={[]}
        onSaveAs={() => {}}
        kanbanFields={kanbanFields}
        kanbanField="status"
        onKanbanFieldChange={onKanbanFieldChange}
      />,
    );
    expect(screen.queryByLabelText("Group by")).toBeNull();
  });

  test("single-candidate kanban field is auto-picked (no picker shown)", () => {
    render(
      <ViewSwitcher
        viewType="kanban"
        onViewTypeChange={() => {}}
        views={[]}
        onSaveAs={() => {}}
        kanbanFields={[{ value: "status", label: "Status" }]}
        kanbanField="status"
        onKanbanFieldChange={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Group by")).toBeNull();
  });

  test("map view offers a geo field picker when there are ≥2 candidates", () => {
    const onGeoFieldChange = mock();
    render(
      <ViewSwitcher
        viewType="map"
        onViewTypeChange={() => {}}
        views={[]}
        onSaveAs={() => {}}
        geoFields={[
          { value: "home", label: "Home" },
          { value: "office", label: "Office" },
        ]}
        geoField="home"
        onGeoFieldChange={onGeoFieldChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Plot"), { target: { value: "office" } });
    expect(onGeoFieldChange).toHaveBeenCalledWith("office");
  });

  test("toggles the active view as default", () => {
    const onSetDefault = mock();
    const { rerender } = render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        activeViewId="v1"
        onSelectView={() => {}}
        onSaveAs={() => {}}
        onSetDefault={onSetDefault}
        activeIsDefault={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set as default" }));
    expect(onSetDefault).toHaveBeenCalledWith(true);
    rerender(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        activeViewId="v1"
        onSelectView={() => {}}
        onSaveAs={() => {}}
        onSetDefault={onSetDefault}
        activeIsDefault
      />,
    );
    const toggle = screen.getByRole("button", { name: "★ Default" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(onSetDefault).toHaveBeenLastCalledWith(false);
  });

  test("renames the active view via a dialog pre-filled with its name", () => {
    const onRename = mock();
    render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        activeViewId="v1"
        onSelectView={() => {}}
        onSaveAs={() => {}}
        onRename={onRename}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const input = screen.getByLabelText("New view name") as HTMLInputElement;
    expect(input.value).toBe("Recent"); // seeded from the active view's name
    fireEvent.change(input, { target: { value: "Latest" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" })); // dialog submit
    expect(onRename).toHaveBeenCalledWith("Latest");
  });

  test("default + rename actions are hidden without an active view", () => {
    render(
      <ViewSwitcher
        viewType="table"
        onViewTypeChange={() => {}}
        views={views}
        onSaveAs={() => {}}
        onSetDefault={() => {}}
        onRename={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Set as default" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rename" })).toBeNull();
  });
});
