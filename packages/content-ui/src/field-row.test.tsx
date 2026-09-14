import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { FieldRow } from "./field-row";

afterEach(cleanup);

describe("FieldRow", () => {
  test("wires label, count, help, error and trailer around the control", () => {
    const { container } = render(
      <FieldRow
        id="f"
        label="Title"
        required
        count="3 / 10"
        help="Shown in the tab."
        error="Too long."
        dirty
        trailer={<span data-testid="trailer" />}
      >
        <input id="f" />
      </FieldRow>,
    );
    const row = container.querySelector("[data-slot=form-field]") as HTMLElement;
    expect(row.getAttribute("data-dirty")).toBe("true");
    expect(screen.getByText("Title").getAttribute("for")).toBe("f");
    expect(screen.getByText("*")).toBeDefined();
    expect(screen.getByText("3 / 10")).toBeDefined();
    expect(document.getElementById("f-description")?.textContent).toBe("Shown in the tab.");
    expect(screen.getByRole("alert").id).toBe("f-error");
    expect(screen.getByTestId("trailer")).toBeDefined();
  });

  test("hides the error when asked and honours htmlFor", () => {
    render(
      <FieldRow id="f" htmlFor="f-en" label="Title" error="Bad" hideError>
        <input id="f-en" />
      </FieldRow>,
    );
    expect(screen.getByText("Title").getAttribute("for")).toBe("f-en");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
