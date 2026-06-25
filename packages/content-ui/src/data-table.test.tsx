import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  test("shows the loading message instead of the empty message while loading", () => {
    render(<DataTable collection={posts} rows={[]} loading emptyMessage="Nothing here" />);
    expect(screen.getByText("Loading…")).toBeDefined();
    expect(screen.queryByText("Nothing here")).toBeNull();
  });

  test("a custom loading message replaces the default", () => {
    render(<DataTable collection={posts} rows={[]} loading loadingMessage="Fetching posts…" />);
    expect(screen.getByText("Fetching posts…")).toBeDefined();
  });

  test("renders decorative skeleton rows while loading with no rows", () => {
    const { container } = render(
      <DataTable collection={posts} rows={[]} loading skeletonRows={3} />,
    );
    // Three placeholder rows, each hidden from assistive tech...
    const skeletonRows = container.querySelectorAll('tbody tr[aria-hidden="true"]');
    expect(skeletonRows.length).toBe(3);
    // ...while the visually-hidden status row still announces "Loading…".
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  test("skeleton rows give way to real rows once they arrive", () => {
    const { container } = render(<DataTable collection={posts} rows={rows} loading />);
    expect(container.querySelectorAll('tbody tr[aria-hidden="true"]').length).toBe(0);
  });

  test("renders a caption when given", () => {
    const { container } = render(<DataTable collection={posts} rows={rows} caption="All posts" />);
    expect(container.querySelector("caption")?.textContent).toBe("All posts");
  });

  test("pins explicit table semantics for the a11y tree", () => {
    const { container } = render(<DataTable collection={posts} rows={rows} />);
    expect(container.querySelector("table")?.getAttribute("role")).toBe("table");
    expect(container.querySelector("thead")?.getAttribute("role")).toBe("rowgroup");
    expect(container.querySelector("tbody")?.getAttribute("role")).toBe("rowgroup");
    expect(container.querySelector("tbody tr")?.getAttribute("role")).toBe("row");
    expect(container.querySelector("tbody td")?.getAttribute("role")).toBe("cell");
    const th = container.querySelector("th");
    expect(th?.getAttribute("role")).toBe("columnheader");
    expect(th?.getAttribute("scope")).toBe("col");
  });

  test("does not make rows interactive without onRowClick", () => {
    render(<DataTable collection={posts} rows={rows} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("onRowClick fires with the row and index on click", () => {
    const onRowClick = mock();
    const { container } = render(
      <DataTable collection={posts} rows={rows} onRowClick={onRowClick} />,
    );
    const bodyRows = container.querySelectorAll("tbody tr");
    fireEvent.click(bodyRows[1] as Element);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]?.[0]).toEqual(rows[1]);
    expect(onRowClick.mock.calls[0]?.[1]).toBe(1);
  });

  test("clickable rows carry a hidden Open button named from titleField", () => {
    const onRowClick = mock();
    const titled = defineCollection({
      slug: "posts",
      titleField: "title",
      fields: { title: fields.string() },
    });
    render(<DataTable collection={titled} rows={rows} onRowClick={onRowClick} />);
    const button = screen.getByRole("button", { name: "Open Hello" });
    // Activating the button (click, or Enter/Space — it's a native button)
    // bubbles to the row's onClick: exactly one activation per press.
    fireEvent.click(button);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(onRowClick.mock.calls[0]?.[1]).toBe(0);
  });

  test("the Open button falls back to the row number without a titleField", () => {
    render(<DataTable collection={posts} rows={rows} onRowClick={mock()} />);
    expect(screen.getByRole("button", { name: "Open row 2" })).toBeDefined();
  });
});

describe("DataTable — sorting", () => {
  test("plain headers (not buttons) without onSortChange", () => {
    render(<DataTable collection={posts} rows={rows} />);
    expect(screen.queryByRole("button", { name: /Title/ })).toBeNull();
  });

  test("sortable headers become buttons and report the clicked column", () => {
    const onSortChange = mock();
    render(
      <DataTable
        collection={posts}
        rows={rows}
        columns={["title", "views"]}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    expect(onSortChange).toHaveBeenCalledWith("title");
  });

  test("marks the active sort column with aria-sort", () => {
    render(
      <DataTable
        collection={posts}
        rows={rows}
        columns={["title", "views"]}
        sort={{ field: "views", direction: "desc" }}
        onSortChange={mock()}
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "Title" }).getAttribute("aria-sort"),
    ).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Views" }).getAttribute("aria-sort")).toBe(
      "descending",
    );
  });
});
