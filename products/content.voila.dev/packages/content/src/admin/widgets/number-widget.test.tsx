import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { fields } from "@voila/content-schema";
import { NumberWidget } from "./number-widget.tsx";

afterEach(cleanup);

const base = { id: "f", name: "views" } as const;

describe("NumberWidget", () => {
  test("renders a number input wired to min/max/step", () => {
    const { container } = render(
      <NumberWidget
        {...base}
        field={fields.number({ min: 0, max: 100, step: 5 })}
        value={10}
        onChange={() => {}}
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
    expect(input.step).toBe("5");
    expect(input.value).toBe("10");
  });

  test("emits a parsed number via onChange", () => {
    const onChange = mock();
    const { container } = render(
      <NumberWidget {...base} field={fields.number()} value={undefined} onChange={onChange} />,
    );
    fireEvent.change(container.querySelector("input") as HTMLInputElement, {
      target: { value: "42" },
    });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  test("emits undefined when cleared rather than NaN", () => {
    const onChange = mock();
    const { container } = render(
      <NumberWidget {...base} field={fields.number()} value={7} onChange={onChange} />,
    );
    fireEvent.change(container.querySelector("input") as HTMLInputElement, {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
