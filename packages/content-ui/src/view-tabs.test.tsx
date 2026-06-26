import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ViewFieldChoices, type ViewTabItem, ViewTabs } from "./view-tabs";

afterEach(cleanup);

const fields: ViewFieldChoices = {
  kanban: [{ value: "status", label: "Status" }],
  geo: [],
  date: [
    { value: "startsAt", label: "Starts at" },
    { value: "endsAt", label: "Ends at" },
  ],
};

const views: ViewTabItem[] = [
  { id: "default-posts", name: "Table", type: "table", seeded: true, isDefault: true },
  { id: "v2", name: "Board", type: "kanban", seeded: false, isDefault: false },
];

function setup(overrides: Partial<React.ComponentProps<typeof ViewTabs>> = {}) {
  const props = {
    views,
    activeViewId: "default-posts",
    onSelect: mock(),
    onCreate: mock(),
    onRename: mock(),
    onDelete: mock(),
    onSetDefault: mock(),
    onReorder: mock(),
    fields,
    ...overrides,
  };
  render(<ViewTabs {...props} />);
  return props;
}

describe("ViewTabs", () => {
  test("renders a tab per view and selects on click", () => {
    const props = setup();
    expect(screen.getByRole("tab", { name: /Table/ })).toBeDefined();
    fireEvent.click(screen.getByRole("tab", { name: "Board" }));
    expect(props.onSelect).toHaveBeenCalledWith("v2");
  });

  test("marks the active tab as selected", () => {
    setup({ activeViewId: "v2" });
    expect(screen.getByRole("tab", { name: "Board" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /Table/ }).getAttribute("aria-selected")).toBe("false");
  });

  test("creates a calendar view with the chosen start/end fields", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Add view" }));
    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "Schedule" } });
    fireEvent.change(screen.getByLabelText("View type"), { target: { value: "calendar" } });
    // The calendar pickers appear; choose an end field.
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "endsAt" } });
    fireEvent.click(screen.getByRole("button", { name: "Create view" }));

    expect(props.onCreate).toHaveBeenCalledTimes(1);
    expect(props.onCreate.mock.calls[0]?.[0]).toEqual({
      name: "Schedule",
      type: "calendar",
      config: { calendarField: "startsAt", calendarEndField: "endsAt" },
    });
  });

  test("only offers types the collection's fields support", () => {
    setup({ fields: { kanban: [], geo: [], date: [] } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add view" }));
    const options = Array.from(screen.getByLabelText("View type").querySelectorAll("option")).map(
      (o) => o.textContent,
    );
    // No kanban/date/geo fields → only the Table type is offered.
    expect(options).toEqual(["Table"]);
  });

  test("right-clicking the seeded default view offers default toggle but not delete", () => {
    const props = setup({ activeViewId: "default-posts" });
    fireEvent.contextMenu(screen.getByRole("tab", { name: /Table/ }));
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
    // It's already the default, so the toggle reads "Remove default".
    fireEvent.click(screen.getByRole("menuitem", { name: "Remove default" }));
    expect(props.onSetDefault).toHaveBeenCalledWith("default-posts", false);
  });

  test("a non-seeded view can be deleted from its context menu", () => {
    const props = setup({ activeViewId: "v2" });
    fireEvent.contextMenu(screen.getByRole("tab", { name: "Board" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(props.onDelete).toHaveBeenCalledWith("v2");
  });

  test("editing a view selects it and shows the host editor", () => {
    const props = setup({
      activeViewId: "default-posts",
      editor: <button type="button">My filters</button>,
    });
    fireEvent.contextMenu(screen.getByRole("tab", { name: "Board" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit view" }));
    // Opening the editor selects the view it edits.
    expect(props.onSelect).toHaveBeenCalledWith("v2");
    // The host-provided editor renders inside the dialog.
    expect(screen.getByRole("button", { name: "My filters" })).toBeDefined();
  });

  test("dragging a tab onto another emits the reordered id list", () => {
    const props = setup({ activeViewId: "default-posts" });
    const board = screen.getByRole("tab", { name: "Board" }).parentElement as HTMLElement;
    const table = screen.getByRole("tab", { name: /Table/ }).parentElement as HTMLElement;
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(type: string, val: string) {
        this.data[type] = val;
      },
      getData(type: string) {
        return this.data[type] ?? "";
      },
      effectAllowed: "",
    };
    fireEvent.dragStart(board, { dataTransfer });
    fireEvent.dragOver(table, { dataTransfer });
    fireEvent.drop(table, { dataTransfer });
    // Board (v2) moved before Table (default-posts).
    expect(props.onReorder).toHaveBeenCalledWith(["v2", "default-posts"]);
  });
});
