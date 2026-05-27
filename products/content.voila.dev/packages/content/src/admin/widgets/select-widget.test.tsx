import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fields } from "@voila/content-schema";
import { SelectWidget } from "./select-widget.tsx";

afterEach(cleanup);

const base = { id: "f", name: "status" } as const;

describe("SelectWidget", () => {
  test("renders an option per choice plus a placeholder", () => {
    render(
      <SelectWidget
        {...base}
        field={fields.select({ options: ["draft", "published"] })}
        value="draft"
        onChange={() => {}}
      />,
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    // placeholder + 2 options
    expect(select.querySelectorAll("option").length).toBe(3);
    expect(select.value).toBe("draft");
  });

  test("emits the chosen value", () => {
    const onChange = mock();
    render(
      <SelectWidget
        {...base}
        field={fields.select({ options: ["draft", "published"] })}
        value="draft"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "published" } });
    expect(onChange).toHaveBeenCalledWith("published");
  });

  test("uses the object option's value, showing its label", () => {
    render(
      <SelectWidget
        {...base}
        field={fields.select({ options: [{ label: "Published", value: "pub" }] })}
        value="pub"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Published")).toBeDefined();
    const opt = screen.getByText("Published") as HTMLOptionElement;
    expect(opt.value).toBe("pub");
  });
});
