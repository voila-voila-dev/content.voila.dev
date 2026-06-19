import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { StatCard } from "./stat-card";

afterEach(cleanup);

describe("StatCard", () => {
  test("renders the label and value", () => {
    render(<StatCard label="Posts" value={42} />);
    expect(screen.getByText("Posts")).toBeDefined();
    expect(screen.getByText("42")).toBeDefined();
  });

  test("renders an optional description and icon", () => {
    render(<StatCard label="Posts" value={42} description="all time" icon={<span>icon</span>} />);
    expect(screen.getByText("all time")).toBeDefined();
    expect(screen.getByText("icon")).toBeDefined();
  });

  test("is not a link without href", () => {
    render(<StatCard label="Posts" value={42} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  test("becomes a link to href, wrapping the value", () => {
    render(<StatCard label="Posts" value={42} href="/admin/posts" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/admin/posts");
    expect(link.textContent).toContain("42");
  });

  test("renderLink supplies a custom anchor element receiving the body", () => {
    render(
      <StatCard
        label="Posts"
        value={42}
        href="/admin/posts"
        renderLink={(href, children) => (
          <a href={href} data-testid="custom">
            {children}
          </a>
        )}
      />,
    );
    const link = screen.getByTestId("custom");
    expect(link.getAttribute("href")).toBe("/admin/posts");
    expect(link.textContent).toContain("Posts");
  });
});
