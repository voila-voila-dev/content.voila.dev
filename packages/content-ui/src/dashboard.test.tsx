import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { Dashboard } from "./dashboard";

afterEach(cleanup);

const config = defineConfig({
  branding: { name: "Acme" },
  collections: {
    posts: defineCollection({
      slug: "posts",
      label: "Blog Posts",
      fields: { title: fields.string() },
    }),
    authors: defineCollection({ slug: "authors", fields: { name: fields.string() } }),
  },
});

/** The collection tile a title link belongs to. */
function tileOf(link: HTMLElement): HTMLElement {
  return link.closest('[data-slot="collection-tile"]') as HTMLElement;
}

describe("Dashboard", () => {
  test("exposes the dashboard slot on its root", () => {
    const { baseElement } = render(<Dashboard.Root config={config} />);
    expect(baseElement.querySelector('[data-slot="dashboard"]')).not.toBeNull();
  });

  test("renders one card per collection, linking to its list", () => {
    render(<Dashboard.Root config={config} counts={{ posts: 12, authors: 3 }} />);
    const posts = screen.getByRole("link", { name: "Blog Posts" });
    expect(posts.getAttribute("href")).toBe("/admin/posts");
    expect(within(tileOf(posts)).getByText("12")).toBeDefined();
    const authors = screen.getByRole("link", { name: "Authors" });
    expect(authors.getAttribute("href")).toBe("/admin/authors");
    expect(within(tileOf(authors)).getByText("3")).toBeDefined();
  });

  test("each tile carries a quick New link to the collection's create page", () => {
    render(<Dashboard.Root config={config} />);
    const news = screen.getAllByRole("link", { name: "New" });
    expect(news.map((a) => a.getAttribute("href"))).toEqual([
      "/admin/posts/new",
      "/admin/authors/new",
    ]);
  });

  test("hides the quick New link when the collection turns create off", () => {
    const readMostly = defineConfig({
      branding: { name: "Acme" },
      collections: {
        posts: defineCollection({ slug: "posts", fields: { title: fields.string() } }),
        listings: defineCollection({
          slug: "listings",
          external: true,
          operations: { create: false },
          fields: { ref: fields.string() },
        }),
      },
    });
    render(<Dashboard.Root config={readMostly} />);
    expect(screen.getAllByRole("link", { name: "New" }).map((a) => a.getAttribute("href"))).toEqual(
      ["/admin/posts/new"],
    );
    // The tile itself still renders and links to the list.
    expect(screen.getByRole("link", { name: "Listings" }).getAttribute("href")).toBe(
      "/admin/listings",
    );
  });

  test("shows an em-dash for a collection with no count", () => {
    render(<Dashboard.Root config={config} counts={{ posts: 12 }} />);
    const authors = screen.getByRole("link", { name: "Authors" });
    expect(within(tileOf(authors)).getByText("—")).toBeDefined();
  });

  test("renders an em-dash for every card when no counts are given", () => {
    render(<Dashboard.Root config={config} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  test("formats large counts with separators", () => {
    render(<Dashboard.Root config={config} counts={{ posts: 1200, authors: 0 }} />);
    expect(screen.getByText((1200).toLocaleString())).toBeDefined();
    // zero is a real count, not a missing one → renders "0", not an em-dash.
    expect(screen.getByText("0")).toBeDefined();
  });

  test("threads basePath into the card hrefs", () => {
    render(<Dashboard.Root config={config} basePath="/cms" />);
    expect(screen.getByRole("link", { name: "Blog Posts" }).getAttribute("href")).toBe(
      "/cms/posts",
    );
  });

  test("renders a title when given", () => {
    render(<Dashboard.Root config={config} title="Overview" />);
    expect(screen.getByRole("heading", { name: "Overview" })).toBeDefined();
  });

  test("renderLink customizes the card links", () => {
    render(
      <Dashboard.Root
        config={config}
        renderLink={(href, children) => (
          <a href={href} data-variant="router">
            {children}
          </a>
        )}
      />,
    );
    expect(screen.getByRole("link", { name: "Blog Posts" }).getAttribute("data-variant")).toBe(
      "router",
    );
  });

  test("shows the empty message with no collections", () => {
    const bare = defineConfig({ branding: { name: "Bare" } });
    render(<Dashboard.Root config={bare} />);
    expect(screen.getByText("No collections configured.")).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("Dashboard loading state", () => {
  test("shows skeleton rows, not the word Loading", () => {
    const { container } = render(
      <Dashboard.Root config={config} recentLoading recent={[]} basePath="" />,
    );
    expect(container.querySelector("[data-slot=dashboard-recent-skeleton]")).not.toBeNull();
    expect(container.textContent).not.toContain("Loading");
  });

  test("the placeholder is hidden from assistive tech", () => {
    const { container } = render(
      <Dashboard.Root config={config} recentLoading recent={[]} basePath="" />,
    );
    expect(
      container.querySelector("[data-slot=dashboard-recent-skeleton]")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  test("real rows replace the placeholder once they arrive", () => {
    const { container } = render(
      <Dashboard.Root
        config={config}
        recentLoading={false}
        recent={[{ id: "1", title: "Vertigo", collection: "Films", href: "/films/1" }]}
        basePath=""
      />,
    );
    expect(container.querySelector("[data-slot=dashboard-recent-skeleton]")).toBeNull();
    expect(container.textContent).toContain("Vertigo");
  });
});
