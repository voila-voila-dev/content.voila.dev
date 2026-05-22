import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Badge } from "#components/badge";

describe("Badge", () => {
  test("renders a <div> with the default variant classes", () => {
    render(<Badge>new</Badge>);
    const el = screen.getByText("new");
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("bg-primary");
  });

  test("applies the outline variant classes", () => {
    render(<Badge variant="outline">draft</Badge>);
    const el = screen.getByText("draft");
    expect(el.className).toContain("text-foreground");
  });
});
