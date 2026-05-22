import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Button } from "#components/button";

describe("Button", () => {
  test("renders its children as a <button>", () => {
    render(<Button>Save</Button>);
    const el = screen.getByRole("button", { name: "Save" });
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("type")).toBe("button");
  });

  test("applies the destructive variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const el = screen.getByRole("button", { name: "Delete" });
    expect(el.className).toContain("bg-destructive");
  });

  test("merges user className with variant classes", () => {
    render(<Button className="custom-x">x</Button>);
    const el = screen.getByRole("button", { name: "x" });
    expect(el.className).toContain("custom-x");
    expect(el.className).toContain("inline-flex");
  });
});
