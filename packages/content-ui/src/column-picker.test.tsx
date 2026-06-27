import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { ColumnPicker } from "./column-picker";

afterEach(cleanup);

const collection = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string(),
    views: fields.number(),
    author: fields.string(),
    secret: fields.string({ hidden: true }),
  },
});

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Columns" }));
}

describe("ColumnPicker", () => {
  test("lists a checkbox per non-hidden field, skipping hidden", () => {
    render(
      <ColumnPicker
        collection={collection}
        value={["title", "views", "author"]}
        onChange={() => {}}
      />,
    );
    open();
    expect(screen.getByRole("checkbox", { name: "Title" })).toBeDefined();
    expect(screen.getByRole("checkbox", { name: "Author" })).toBeDefined();
    expect(screen.queryByRole("checkbox", { name: "Secret" })).toBeNull();
  });

  test("toggling an unchecked field adds it to the visible list", () => {
    let next: string[] = [];
    render(<ColumnPicker collection={collection} value={["title"]} onChange={(c) => (next = c)} />);
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Author" }));
    expect(next).toEqual(["title", "author"]);
  });

  test("toggling a checked field removes it", () => {
    let next: string[] = [];
    render(
      <ColumnPicker
        collection={collection}
        value={["title", "views"]}
        onChange={(c) => (next = c)}
      />,
    );
    open();
    fireEvent.click(screen.getByRole("checkbox", { name: "Views" }));
    expect(next).toEqual(["title"]);
  });

  test("moving a column down reorders the visible list", () => {
    let next: string[] = [];
    render(
      <ColumnPicker
        collection={collection}
        value={["title", "views", "author"]}
        onChange={(c) => (next = c)}
      />,
    );
    open();
    fireEvent.click(screen.getByRole("button", { name: "Move Title down" }));
    expect(next).toEqual(["views", "title", "author"]);
  });

  test("dragging a column onto another inserts it at that position", () => {
    let next: string[] = [];
    render(
      <ColumnPicker
        collection={collection}
        value={["title", "views", "author"]}
        onChange={(c) => (next = c)}
      />,
    );
    open();
    const row = (name: string) =>
      screen.getByRole("checkbox", { name }).closest("li") as HTMLElement;
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? "",
      effectAllowed: "",
    };
    // Drag "Author" (last) up onto "Title" (first) → author lands before title.
    fireEvent.dragStart(row("Author"), { dataTransfer });
    fireEvent.dragOver(row("Title"), { dataTransfer });
    fireEvent.drop(row("Title"), { dataTransfer });
    expect(next).toEqual(["author", "title", "views"]);
  });

  test("dropping a column on itself leaves the order unchanged", () => {
    // Seed `next` with an array (not null) so it stays array-typed for tsc.
    let next: string[] = ["title", "views", "author"];
    render(
      <ColumnPicker
        collection={collection}
        value={["title", "views", "author"]}
        onChange={(c) => (next = c)}
      />,
    );
    open();
    const row = (name: string) =>
      screen.getByRole("checkbox", { name }).closest("li") as HTMLElement;
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? "",
      effectAllowed: "",
    };
    fireEvent.dragStart(row("Views"), { dataTransfer });
    fireEvent.drop(row("Views"), { dataTransfer });
    expect(next).toEqual(["title", "views", "author"]);
  });
});
