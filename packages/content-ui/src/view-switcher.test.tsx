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
});
