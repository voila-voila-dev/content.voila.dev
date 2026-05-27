import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fields } from "@voila/content-schema";
import { BooleanWidget } from "./boolean-widget.tsx";

afterEach(cleanup);

const base = { id: "f", name: "published" } as const;

describe("BooleanWidget", () => {
  test("renders a switch reflecting the current value", () => {
    render(<BooleanWidget {...base} field={fields.boolean()} value={true} onChange={() => {}} />);
    const sw = screen.getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("true");
  });

  test("treats an unset value as off", () => {
    render(
      <BooleanWidget {...base} field={fields.boolean()} value={undefined} onChange={() => {}} />,
    );
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  test("emits the toggled value on click", () => {
    const onChange = mock();
    render(<BooleanWidget {...base} field={fields.boolean()} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
