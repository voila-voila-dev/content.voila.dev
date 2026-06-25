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
  test("renders a column per declared enum value (empty ones included)", () => {
    render(<KanbanView collection={tasks} rows={rows} groupField="status" />);
    // Columns are <section aria-label> regions.
    expect(screen.getByRole("region", { name: "Todo" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Doing" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Done" })).toBeDefined();
  });

  test("places each row's card under its group, titled by titleField", () => {
    render(<KanbanView collection={tasks} rows={rows} groupField="status" />);
    const todo = screen.getByRole("region", { name: "Todo" });
    expect(todo.textContent).toContain("First");
    expect(todo.textContent).toContain("Third");
    expect(todo.textContent).not.toContain("Second");
  });

  test("dropping a card on another column calls onMove with the row id + value", () => {
    const onMove = mock();
    render(<KanbanView collection={tasks} rows={rows} groupField="status" onMove={onMove} />);
    const card = screen.getByText("First").closest("article") as HTMLElement;
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? "",
      effectAllowed: "",
    };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "Done" }), { dataTransfer });
    expect(onMove).toHaveBeenCalledWith("1", "done");
  });

  test("clicking a card opens it via onRowClick", () => {
    const onRowClick = mock();
    render(
      <KanbanView collection={tasks} rows={rows} groupField="status" onRowClick={onRowClick} />,
    );
    fireEvent.click(screen.getByText("Second").closest("article") as HTMLElement);
    expect(onRowClick.mock.calls[0]?.[0]).toMatchObject({ id: "2" });
  });

  test("shows the empty message with no rows", () => {
    render(
      <KanbanView collection={tasks} rows={[]} groupField="status" emptyMessage="Nothing here" />,
    );
    expect(screen.getByText("Nothing here")).toBeDefined();
  });

  test("a numeric-enum drag reports the ORIGINAL number, not its string key", () => {
    // Regression: a numeric enum's column key is the string "2", but the field
    // validator wants the number 2 — onMove must carry the original value.
    const priorities = defineCollection({
      slug: "items",
      titleField: "title",
      fields: {
        title: fields.string(),
        priority: fields.enum({ values: { Low: 1, High: 2 } }),
      },
    });
    const onMove = mock();
    render(
      <KanbanView
        collection={priorities}
        rows={[{ id: "1", title: "T", priority: 1 }]}
        groupField="priority"
        onMove={onMove}
      />,
    );
    const card = screen.getByText("T").closest("article") as HTMLElement;
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? "",
      effectAllowed: "",
    };
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "High" }), { dataTransfer });
    expect(onMove).toHaveBeenCalledWith("1", 2);
  });
});
