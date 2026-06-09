import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { defineCollection, defineConfig, defineSingleton, fields } from "@voila/content";
import { Sidebar } from "@voila/ui";
import { AppSidebar, type AppSidebarProps } from "./app-sidebar";

// `screen` queries the whole document; AppSidebar needs an ambient
// Sidebar.Provider (AdminShell supplies one in real use), so wrap it here.
afterEach(cleanup);

const config = defineConfig({
  branding: { name: "Acme CMS" },
  collections: {
    posts: defineCollection({ slug: "posts", fields: { title: fields.string() } }),
    authors: defineCollection({ slug: "authors", fields: { name: fields.string() } }),
  },
  singletons: {
    settings: defineSingleton({ slug: "settings", fields: { siteName: fields.string() } }),
  },
});

function renderSidebar(props: Partial<AppSidebarProps> = {}): void {
  render(
    <Sidebar.Provider>
      <AppSidebar config={config} {...props} />
    </Sidebar.Provider>,
  );
}

describe("AppSidebar", () => {
  test("shows the branding name", () => {
    renderSidebar();
    expect(screen.getByText("Acme CMS")).toBeDefined();
  });

  test("renders a link per collection and singleton with config-derived hrefs", () => {
    renderSidebar();
    const posts = screen.getByRole("link", { name: "Posts" });
    expect(posts.getAttribute("href")).toBe("/admin/posts");
    expect(screen.getByRole("link", { name: "Authors" }).getAttribute("href")).toBe(
      "/admin/authors",
    );
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe(
      "/admin/settings",
    );
  });

  test("groups collections and singletons under separate labels", () => {
    renderSidebar();
    expect(screen.getByText("Collections")).toBeDefined();
    expect(screen.getByText("Content")).toBeDefined();
  });

  test("marks the active collection via aria/data state", () => {
    renderSidebar({ currentPath: "/admin/posts/123" });
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("link", { name: "Authors" }).getAttribute("data-active")).toBe("false");
  });

  test("threads basePath through to the hrefs", () => {
    renderSidebar({ basePath: "/cms" });
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("href")).toBe("/cms/posts");
  });

  test("renderLink can supply a custom anchor element", () => {
    renderSidebar({
      // biome-ignore lint/a11y/useAnchorContent: the sidebar injects the label as children
      renderLink: (item) => <a href={item.href} data-testid={`link-${item.slug}`} />,
    });
    expect(screen.getByTestId("link-posts").getAttribute("href")).toBe("/admin/posts");
  });

  test("renders a footer when provided", () => {
    renderSidebar({ footer: <span>Sign out</span> });
    expect(screen.getByText("Sign out")).toBeDefined();
  });

  test("omits the singletons group when there are none", () => {
    const onlyCollections = defineConfig({
      branding: { name: "X" },
      collections: {
        posts: defineCollection({ slug: "posts", fields: { title: fields.string() } }),
      },
    });
    render(
      <Sidebar.Provider>
        <AppSidebar config={onlyCollections} />
      </Sidebar.Provider>,
    );
    expect(screen.queryByText("Content")).toBeNull();
    expect(screen.getByText("Collections")).toBeDefined();
  });
});
