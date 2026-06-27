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

describe("Dashboard", () => {
  test("exposes the dashboard slot on its root", () => {
    const { baseElement } = render(<Dashboard.Root config={config} />);
    expect(baseElement.querySelector('[data-slot="dashboard"]')).not.toBeNull();
  });

  test("renders one card per collection, linking to its list", () => {
    render(<Dashboard.Root config={config} counts={{ posts: 12, authors: 3 }} />);
    const posts = screen.getByRole("link", { name: /Blog Posts/ });
    expect(posts.getAttribute("href")).toBe("/admin/posts");
    expect(within(posts).getByText("12")).toBeDefined();
    const authors = screen.getByRole("link", { name: /Authors/ });
    expect(authors.getAttribute("href")).toBe("/admin/authors");
    expect(within(authors).getByText("3")).toBeDefined();
  });

  test("shows an em-dash for a collection with no count", () => {
    render(<Dashboard.Root config={config} counts={{ posts: 12 }} />);
    const authors = screen.getByRole("link", { name: /Authors/ });
    expect(within(authors).getByText("—")).toBeDefined();
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
    expect(screen.getByRole("link", { name: /Blog Posts/ }).getAttribute("href")).toBe(
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
    expect(screen.getByRole("link", { name: /Blog Posts/ }).getAttribute("data-variant")).toBe(
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
