import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { fields } from "@voila/content-schema";
import { FieldWidget } from "./field-widget.tsx";

afterEach(cleanup);

describe("FieldWidget", () => {
  test("humanizes the field name into a label and resolves the widget", () => {
    const { container } = render(
      <FieldWidget
        name="publishedAt"
        field={fields.date()}
        value="2026-05-21"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Published At")).toBeDefined();
    expect((container.querySelector("input") as HTMLInputElement).type).toBe("date");
  });

  test("prefers an explicit field label", () => {
    render(
      <FieldWidget
        name="title"
        field={fields.string({ label: "Headline" })}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Headline")).toBeDefined();
  });

  test("marks required fields with an asterisk", () => {
    render(
      <FieldWidget
        name="title"
        field={fields.string({ required: true })}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("*")).toBeDefined();
  });

  test("surfaces an error and wires it to the control via aria", () => {
    const { container } = render(
      <FieldWidget
        name="title"
        field={fields.string()}
        value=""
        onChange={() => {}}
        error="Required"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Required");
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });
});
