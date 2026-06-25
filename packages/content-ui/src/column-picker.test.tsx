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
    expect(screen.getByLabelText("Title")).toBeDefined();
    expect(screen.getByLabelText("Author")).toBeDefined();
    expect(screen.queryByLabelText("Secret")).toBeNull();
  });

  test("toggling an unchecked field adds it to the visible list", () => {
    let next: string[] = [];
    render(<ColumnPicker collection={collection} value={["title"]} onChange={(c) => (next = c)} />);
    open();
    fireEvent.click(screen.getByLabelText("Author"));
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
    fireEvent.click(screen.getByLabelText("Views"));
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
});
