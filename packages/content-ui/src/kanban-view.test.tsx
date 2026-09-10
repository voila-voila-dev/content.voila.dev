import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { KanbanView } from "./kanban-view";

afterEach(cleanup);

const tasks = defineCollection({
  slug: "tasks",
  titleField: "title",
  fields: {
    title: fields.string(),
    status: fields.enum({ values: { Todo: "todo", Doing: "doing", Done: "done" } }),
  },
});

const rows = [
  { id: "1", title: "First", status: "todo" },
  { id: "2", title: "Second", status: "doing" },
  { id: "3", title: "Third", status: "todo" },
];

describe("KanbanView", () => {
  test("exposes the kanban-view slot on its root (board and empty state)", () => {
    const { baseElement, rerender } = render(
      <KanbanView.Root collection={tasks} rows={rows} groupField="status" />,
    );
    expect(baseElement.querySelector('[data-slot="kanban-view"]')).not.toBeNull();
    rerender(<KanbanView.Root collection={tasks} rows={[]} groupField="status" />);
    expect(baseElement.querySelector('[data-slot="kanban-view"]')).not.toBeNull();
  });

  test("renders a column per declared enum value (empty ones included)", () => {
    render(<KanbanView.Root collection={tasks} rows={rows} groupField="status" />);
    // Columns are <section aria-label> regions.
    expect(screen.getByRole("region", { name: "Todo" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Doing" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Done" })).toBeDefined();
  });

  test("places each row's card under its group, titled by titleField", () => {
    render(<KanbanView.Root collection={tasks} rows={rows} groupField="status" />);
    const todo = screen.getByRole("region", { name: "Todo" });
    expect(todo.textContent).toContain("First");
    expect(todo.textContent).toContain("Third");
    expect(todo.textContent).not.toContain("Second");
  });

  test("cards are named by titleField and open the row on click", () => {
    const onRowClick = mock();
    render(
      <KanbanView.Root
        collection={tasks}
        rows={rows}
        groupField="status"
        onRowClick={onRowClick}
      />,
    );
    const card = screen.getByRole("article", { name: "First" });
    fireEvent.click(card);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });

  test("with onMove, cards are draggable (grab cursor) and columns are drop regions", () => {
    render(<KanbanView.Root collection={tasks} rows={rows} groupField="status" onMove={mock()} />);
    const card = screen.getByRole("article", { name: "First" });
    expect(card.className).toContain("cursor-grab");
    expect(screen.getByRole("region", { name: "Done" })).toBeDefined();
  });

  test("without onMove, cards are inert (no grab cursor)", () => {
    render(<KanbanView.Root collection={tasks} rows={rows} groupField="status" />);
    expect(screen.getByRole("article", { name: "First" }).className).not.toContain("cursor-grab");
  });

  test("clicking a card opens it via onRowClick", () => {
    const onRowClick = mock();
    render(
      <KanbanView.Root
        collection={tasks}
        rows={rows}
        groupField="status"
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText("Second").closest("article") as HTMLElement);
    expect(onRowClick.mock.calls[0]?.[0]).toMatchObject({ id: "2" });
  });

  test("shows the empty message with no rows", () => {
    render(
      <KanbanView.Root
        collection={tasks}
        rows={[]}
        groupField="status"
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText("Nothing here")).toBeDefined();
  });

  test("a numeric enum still renders a column per declared value", () => {
    const priorities = defineCollection({
      slug: "todos",
      titleField: "title",
      fields: { title: fields.string(), priority: fields.enum({ values: { Low: 1, High: 2 } }) },
    });
    render(
      <KanbanView.Root
        collection={priorities}
        rows={[{ id: "1", title: "Ship", priority: 1 }]}
        groupField="priority"
        onMove={mock()}
      />,
    );
    expect(screen.getByRole("region", { name: "Low" }).textContent).toContain("Ship");
    expect(screen.getByRole("region", { name: "High" })).toBeDefined();
  });
});
