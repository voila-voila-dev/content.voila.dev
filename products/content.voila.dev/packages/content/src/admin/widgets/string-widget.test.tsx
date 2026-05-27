import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { fields } from "@voila/content-schema";
import { StringWidget } from "./string-widget.tsx";

afterEach(cleanup);

const base = { id: "f", name: "title" } as const;

describe("StringWidget", () => {
  test("renders a single-line input showing the current value", () => {
    const { container } = render(
      <StringWidget {...base} field={fields.string()} value="Hello" onChange={() => {}} />,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.value).toBe("Hello");
  });

  test("emits typed text via onChange", () => {
    const onChange = mock();
    const { container } = render(
      <StringWidget {...base} field={fields.string()} value="" onChange={onChange} />,
    );
    fireEvent.change(container.querySelector("input") as HTMLInputElement, {
      target: { value: "Hi there" },
    });
    expect(onChange).toHaveBeenCalledWith("Hi there");
  });

  test("renders a textarea when multiline is set", () => {
    const { container } = render(
      <StringWidget
        {...base}
        field={fields.string({ multiline: true, rows: 6 })}
        value="body"
        onChange={() => {}}
      />,
    );
    const ta = container.querySelector("textarea");
    expect(ta).not.toBeNull();
    expect(ta?.getAttribute("rows")).toBe("6");
  });

  test("marks the control invalid for a11y", () => {
    const { container } = render(
      <StringWidget {...base} field={fields.string()} value="" onChange={() => {}} invalid />,
    );
    expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBe("true");
  });
});
