import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { FieldCard } from "./field-card";

afterEach(cleanup);

describe("FieldCard", () => {
  test("renders a body, title, description and footer with an action button", () => {
    render(
      <FieldCard.Root>
        <FieldCard.Body>
          <FieldCard.Title>Content</FieldCard.Title>
          <FieldCard.Description>The post body</FieldCard.Description>
          <p>body fields</p>
        </FieldCard.Body>
        <FieldCard.Footer>
          <FieldCard.FooterDescription>Unsaved</FieldCard.FooterDescription>
          <FieldCard.Button>Save</FieldCard.Button>
        </FieldCard.Footer>
      </FieldCard.Root>,
    );
    expect(screen.getByRole("heading", { name: "Content" })).toBeDefined();
    expect(screen.getByText("The post body")).toBeDefined();
    expect(screen.getByText("Unsaved")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save" })).toBeDefined();
  });

  test("forwards className and props onto the underlying elements", () => {
    const { container } = render(
      <FieldCard.Root className="custom-root" data-testid="card">
        <FieldCard.Body className="custom-body">x</FieldCard.Body>
      </FieldCard.Root>,
    );
    const root = container.querySelector("section");
    expect(root?.className).toContain("custom-root");
    expect(root?.getAttribute("data-testid")).toBe("card");
    expect(container.querySelector(".custom-body")?.className).toContain("bg-card");
  });
});
