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

  test("renders a data-slot on each part", () => {
    const { baseElement: root } = render(
      <FieldCard.Root>
        <FieldCard.Body>
          <FieldCard.Title>Content</FieldCard.Title>
          <FieldCard.Description>The post body</FieldCard.Description>
        </FieldCard.Body>
        <FieldCard.Footer>
          <FieldCard.FooterDescription>Unsaved</FieldCard.FooterDescription>
        </FieldCard.Footer>
      </FieldCard.Root>,
    );
    expect(root.querySelector("[data-slot=field-card]")).not.toBeNull();
    expect(root.querySelector("[data-slot=field-card-body]")).not.toBeNull();
    expect(root.querySelector("[data-slot=field-card-title]")).not.toBeNull();
    expect(root.querySelector("[data-slot=field-card-description]")).not.toBeNull();
    expect(root.querySelector("[data-slot=field-card-footer]")).not.toBeNull();
  });

  test("Card renders a fully-closed, self-contained card", () => {
    const { container } = render(
      <FieldCard.Root>
        <FieldCard.Card>read content</FieldCard.Card>
      </FieldCard.Root>,
    );
    const card = container.querySelector("section > div") as HTMLDivElement;
    expect(card.textContent).toBe("read content");
    // All four borders + corners (no open bottom edge like `Body`).
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("border");
    expect(card.className).toContain("bg-card");
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
