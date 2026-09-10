import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { AdminShell } from "./admin-shell";
import { useRegisterSidebarSection } from "./lib/shell-context";
import { PageLayout } from "./page-layout";

afterEach(cleanup);

const config = defineConfig({
  branding: { name: "Acme CMS" },
  collections: {
    posts: defineCollection({ slug: "posts", fields: { title: fields.string() } }),
  },
});

describe("AdminShell", () => {
  test("renders the sidebar nav and the page body", () => {
    render(
      <AdminShell config={config}>
        <p>Dashboard body</p>
      </AdminShell>,
    );
    expect(screen.getByText("Acme CMS")).toBeDefined();
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("href")).toBe("/admin/posts");
    expect(screen.getByText("Dashboard body")).toBeDefined();
  });

  test("renders no header bar of its own — the page's PageLayout.Header is the one bar", () => {
    render(
      <AdminShell config={config}>
        <PageLayout.Root>
          <PageLayout.Header actions={<button type="button">New</button>}>
            <PageLayout.Title>Posts list</PageLayout.Title>
          </PageLayout.Header>
        </PageLayout.Root>
      </AdminShell>,
    );
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Posts list" })).toBeDefined();
    expect(screen.getByRole("button", { name: "New" })).toBeDefined();
    // Inside the shell, the page header carries the sidebar trigger (the rail
    // is a second, edge-mounted toggle). Appearance is NOT here — it moved into
    // the user menu, so the header slot is free for the page's own actions.
    expect(screen.getAllByRole("button", { name: "Toggle Sidebar" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Toggle theme" })).toBeNull();
  });

  test("swaps the sidebar to a registered entity section", () => {
    function Entity() {
      useRegisterSidebarSection({
        title: "Fjords by Ferry",
        back: { href: "/admin/posts", label: "Posts" },
        items: [
          { id: "content", label: "Content", href: "/admin/posts/1/content", isActive: true },
          { id: "meta", label: "Metadata", href: "/admin/posts/1/meta", isActive: false },
        ],
      });
      return <span>entity</span>;
    }
    render(
      <AdminShell config={config}>
        <Entity />
      </AdminShell>,
    );
    expect(screen.getByText("Fjords by Ferry")).toBeDefined();
    expect(screen.getByRole("link", { name: "Metadata" }).getAttribute("href")).toBe(
      "/admin/posts/1/meta",
    );
    expect(screen.getByRole("link", { name: "Content" }).hasAttribute("data-active")).toBe(true);
    // The top-level tree is gone while the section is registered.
    // …except as the section's back row, which links to the list.
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("href")).toBe("/admin/posts");
  });

  test("wraps the page body in a main landmark", () => {
    render(
      <AdminShell config={config}>
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByRole("main")).toBeDefined();
  });

  test("shows count badges on nav items when counts are given", () => {
    render(
      <AdminShell config={config} counts={{ posts: 1200 }}>
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByText((1200).toLocaleString())).toBeDefined();
  });

  test("threads currentPath to the active nav item", () => {
    render(
      <AdminShell config={config} currentPath="/admin/posts">
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByRole("link", { name: "Posts" }).hasAttribute("data-active")).toBe(true);
  });

  test("renders a search entry only when onSearch is wired", () => {
    const onSearch = mock();
    const { unmount } = render(
      <AdminShell config={config} onSearch={onSearch}>
        <span>body</span>
      </AdminShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    unmount();
    render(
      <AdminShell config={config}>
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.queryByRole("button", { name: /Search/ })).toBeNull();
  });

  test("renders a sidebar footer when provided", () => {
    render(
      <AdminShell config={config} sidebarFooter={<span>Sign out</span>}>
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByText("Sign out")).toBeDefined();
  });
});
