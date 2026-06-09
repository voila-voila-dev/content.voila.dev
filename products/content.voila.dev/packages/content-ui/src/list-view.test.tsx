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
