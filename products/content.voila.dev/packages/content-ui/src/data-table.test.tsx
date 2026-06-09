import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { DataTable } from "./data-table";

// `screen` queries the whole document; without cleanup, rows from earlier tests
// linger and the header/row assertions below see duplicates.
afterEach(cleanup);

const posts = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string(),
    views: fields.number(),
    published: fields.boolean(),
    secret: fields.string({ hidden: true }),
    score: fields.number({ label: "Rating" }),
  },
});

const rows = [
  { id: "1", title: "Hello", views: 1200, published: true, secret: "x", score: 5 },
  { id: "2", title: "World", views: 3, published: false, secret: "y", score: 2 },
];

describe("DataTable", () => {
  test("renders a header per non-hidden field by default, skipping hidden", () => {
    render(<DataTable collection={posts} rows={rows} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Title", "Views", "Published", "Rating"]);
  });

  test("uses meta.label when present, else humanizes the key", () => {
    render(<DataTable collection={posts} rows={rows} />);
    expect(screen.getByRole("columnheader", { name: "Rating" })).toBeDefined();
  });

  test("renders one row per record with cells from FieldRenderer", () => {
    render(<DataTable collection={posts} rows={rows} columns={["title", "views", "published"]} />);
    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.getByText((1200).toLocaleString())).toBeDefined();
    expect(screen.getByText("Yes")).toBeDefined();
    expect(screen.getByText("No")).toBeDefined();
  });

  test("explicit columns are rendered in order and may include hidden fields", () => {
    render(<DataTable collection={posts} rows={rows} columns={["secret", "title"]} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Secret", "Title"]);
  });

  test("ignores unknown column keys", () => {
    render(<DataTable collection={posts} rows={rows} columns={["title", "nope"]} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Title"]);
  });

  test("shows the empty message when there are no rows", () => {
    render(<DataTable collection={posts} rows={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeDefined();
  });

  test("renders a caption when given", () => {
    const { container } = render(<DataTable collection={posts} rows={rows} caption="All posts" />);
    expect(container.querySelector("caption")?.textContent).toBe("All posts");
  });
});
