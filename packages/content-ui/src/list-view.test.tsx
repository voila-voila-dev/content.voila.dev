import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import { ListView } from "./list-view";

afterEach(cleanup);

const posts = defineCollection({
  slug: "posts",
  label: "Blog Posts",
  fields: {
    title: fields.string(),
    views: fields.number(),
  },
});

const rows = [
  { id: "1", title: "Hello", views: 12 },
  { id: "2", title: "World", views: 3 },
];

describe("ListView", () => {
  test("titles with the collection label and renders the table", () => {
    render(<ListView collection={posts} rows={rows} />);
    expect(screen.getByRole("heading", { name: "Blog Posts" })).toBeDefined();
    expect(screen.getByText("Hello")).toBeDefined();
    expect(screen.getByText("World")).toBeDefined();
  });

  test("falls back to the humanized slug when there's no label", () => {
    const bare = defineCollection({ slug: "team-members", fields: { name: fields.string() } });
    render(<ListView collection={bare} rows={[]} />);
    expect(screen.getByRole("heading", { name: "Team Members" })).toBeDefined();
  });

  test("an explicit title overrides the default", () => {
    render(<ListView collection={posts} rows={rows} title="All the posts" />);
    expect(screen.getByRole("heading", { name: "All the posts" })).toBeDefined();
  });

  test("renders an actions slot and a description", () => {
    render(
      <ListView
        collection={posts}
        rows={rows}
        description="Everything published"
        actions={<button type="button">New</button>}
      />,
    );
    expect(screen.getByText("Everything published")).toBeDefined();
    expect(screen.getByRole("button", { name: "New" })).toBeDefined();
  });

  test("forwards row clicks", () => {
    const onRowClick = mock();
    const { container } = render(
      <ListView collection={posts} rows={rows} onRowClick={onRowClick} />,
    );
    fireEvent.click(container.querySelector("tbody tr") as Element);
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0]?.[0]).toEqual(rows[0]);
  });

  test("shows an error message", () => {
    render(<ListView collection={posts} rows={[]} error="Could not load posts" />);
    expect(screen.getByRole("alert").textContent).toBe("Could not load posts");
  });

  test("shows a loading note", () => {
    render(<ListView collection={posts} rows={rows} loading />);
    expect(screen.getByText("Loading…")).toBeDefined();
  });

  test("loading an empty list shows Loading… in the table, never the empty message", () => {
    render(<ListView collection={posts} rows={[]} loading emptyMessage="No records." />);
    expect(screen.getAllByText("Loading…")).toHaveLength(1);
    expect(screen.queryByText("No records.")).toBeNull();
  });

  test("an empty list without loading shows the empty message only", () => {
    render(<ListView collection={posts} rows={[]} />);
    expect(screen.getByText("No records.")).toBeDefined();
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  test("shows Load more only when there's a cursor and a handler", () => {
    const onLoadMore = mock();
    const { rerender } = render(
      <ListView collection={posts} rows={rows} nextCursor="abc" onLoadMore={onLoadMore} />,
    );
    const button = screen.getByRole("button", { name: "Load more" });
    fireEvent.click(button);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    rerender(<ListView collection={posts} rows={rows} nextCursor={null} onLoadMore={onLoadMore} />);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("hides Load more when there's a cursor but no handler", () => {
    render(<ListView collection={posts} rows={rows} nextCursor="abc" />);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("uses a custom load-more label", () => {
    render(
      <ListView
        collection={posts}
        rows={rows}
        nextCursor="abc"
        onLoadMore={() => {}}
        loadMoreLabel="More posts"
      />,
    );
    expect(screen.getByRole("button", { name: "More posts" })).toBeDefined();
  });
});

describe("ListView status filter", () => {
  const drafted = defineCollection({
    slug: "articles",
    drafts: true,
    fields: { title: fields.string() },
  });

  test("shows the filter for a draft-enabled collection and reports changes", () => {
    const onStatusChange = mock();
    render(
      <ListView collection={drafted} rows={[]} status="any" onStatusChange={onStatusChange} />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Drafts" }));
    expect(onStatusChange).toHaveBeenCalledWith("draft");
  });

  test("hidden for a non-draft collection even when wired", () => {
    render(<ListView collection={posts} rows={rows} status="any" onStatusChange={() => {}} />);
    expect(screen.queryByRole("tab")).toBeNull();
  });

  test("hidden when no onStatusChange handler is wired", () => {
    render(<ListView collection={drafted} rows={[]} />);
    expect(screen.queryByRole("tab")).toBeNull();
  });
});

describe("ListView search box", () => {
  const searchable = defineCollection({
    slug: "articles",
    search: true,
    fields: { title: fields.string() },
  });

  test("shows the search box for a search-enabled collection and reports typing", () => {
    const onSearchChange = mock();
    render(
      <ListView collection={searchable} rows={[]} searchValue="" onSearchChange={onSearchChange} />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "fox" } });
    expect(onSearchChange).toHaveBeenCalledWith("fox");
  });

  test("hidden for a non-search collection even when wired", () => {
    render(<ListView collection={posts} rows={rows} onSearchChange={() => {}} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  test("hidden when no onSearchChange handler is wired", () => {
    render(<ListView collection={searchable} rows={[]} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
  });
});
