import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { defineCollection, defineConfig, fields } from "@voila/content";
import { AdminShell } from "./admin-shell";

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

  test("shows the title and header actions in the header bar", () => {
    render(
      <AdminShell config={config} title="Posts" headerActions={<button type="button">New</button>}>
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByRole("heading", { name: "Posts" })).toBeDefined();
    expect(screen.getByRole("button", { name: "New" })).toBeDefined();
  });

  test("includes a sidebar toggle trigger", () => {
    render(
      <AdminShell config={config}>
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByRole("button", { name: "Toggle Sidebar" })).toBeDefined();
  });

  test("threads currentPath to the active nav item", () => {
    render(
      <AdminShell config={config} currentPath="/admin/posts">
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("data-active")).toBe("true");
  });

  test("renders a theme toggle in the header bar", () => {
    render(
      <AdminShell config={config}>
        <span>body</span>
      </AdminShell>,
    );
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeDefined();
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
