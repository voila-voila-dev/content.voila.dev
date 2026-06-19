import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { StatusBadge } from "./status-badge";

afterEach(cleanup);

const NOW = 1_000_000;

describe("StatusBadge", () => {
  test("renders nothing for a non-draft document", () => {
    const { container } = render(<StatusBadge doc={{ id: "1", title: "x" }} now={NOW} />);
    expect(container.textContent).toBe("");
  });

  test("shows Draft", () => {
    render(<StatusBadge doc={{ status: "draft", publishedAt: null }} now={NOW} />);
    expect(screen.getByText("Draft")).toBeDefined();
  });

  test("shows Published", () => {
    render(<StatusBadge doc={{ status: "published", publishedAt: NOW - 1 }} now={NOW} />);
    expect(screen.getByText("Published")).toBeDefined();
  });

  test("shows Scheduled for a future publishedAt", () => {
    render(<StatusBadge doc={{ status: "published", publishedAt: NOW + 1 }} now={NOW} />);
    expect(screen.getByText("Scheduled")).toBeDefined();
  });
});
