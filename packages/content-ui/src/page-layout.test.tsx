import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { PageLayout } from "./page-layout";

afterEach(cleanup);

describe("PageLayout", () => {
  test("composes a header over a single scrolling body", () => {
    const { container } = render(
      <PageLayout.Root>
        <PageLayout.Header>
          <PageLayout.Title>Posts</PageLayout.Title>
          <PageLayout.Description>All posts</PageLayout.Description>
        </PageLayout.Header>
        <PageLayout.Body>table</PageLayout.Body>
      </PageLayout.Root>,
    );
    // The title is the page's <h1> and is programmatically focusable.
    const h1 = screen.getByRole("heading", { level: 1, name: "Posts" });
    expect(h1.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByText("All posts")).toBeDefined();
    // Exactly one overflow-y-auto region (the body), and the root clips.
    expect(container.querySelector(".overflow-hidden")).not.toBeNull();
    expect(container.querySelectorAll(".overflow-y-auto").length).toBe(1);
    expect(container.textContent).toContain("table");
  });

  test("NavigationLayout + Footer render their children", () => {
    const { container } = render(
      <PageLayout.Root>
        <PageLayout.NavigationLayout>
          <nav>sections</nav>
          <PageLayout.Body>body</PageLayout.Body>
        </PageLayout.NavigationLayout>
        <PageLayout.Footer>footer</PageLayout.Footer>
      </PageLayout.Root>,
    );
    expect(screen.getByRole("navigation").textContent).toBe("sections");
    expect(container.querySelector("footer")?.textContent).toBe("footer");
  });

  test("renders a data-slot on each part", () => {
    const { baseElement: root } = render(
      <PageLayout.Root>
        <PageLayout.Header>
          <PageLayout.Title>Posts</PageLayout.Title>
          <PageLayout.Description>All posts</PageLayout.Description>
        </PageLayout.Header>
        <PageLayout.NavigationLayout>
          <PageLayout.Body>body</PageLayout.Body>
        </PageLayout.NavigationLayout>
        <PageLayout.Footer>footer</PageLayout.Footer>
      </PageLayout.Root>,
    );
    expect(root.querySelector("[data-slot=page-layout]")).not.toBeNull();
    expect(root.querySelector("[data-slot=page-layout-header]")).not.toBeNull();
    expect(root.querySelector("[data-slot=page-layout-title]")).not.toBeNull();
    expect(root.querySelector("[data-slot=page-layout-description]")).not.toBeNull();
    expect(root.querySelector("[data-slot=page-layout-navigation]")).not.toBeNull();
    expect(root.querySelector("[data-slot=page-layout-body]")).not.toBeNull();
    expect(root.querySelector("[data-slot=page-layout-footer]")).not.toBeNull();
  });
});
