import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { fields } from "@voila/content-schema";
import { DateWidget } from "./date-widget.tsx";

afterEach(cleanup);

const base = { id: "f", name: "when" } as const;

describe("DateWidget — date", () => {
  test("renders a date input and emits YYYY-MM-DD unchanged", () => {
    const onChange = mock();
    const { container } = render(
      <DateWidget {...base} field={fields.date()} value="2026-05-21" onChange={onChange} />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2026-05-21");
    fireEvent.change(input, { target: { value: "2026-06-01" } });
    expect(onChange).toHaveBeenCalledWith("2026-06-01");
  });
});

describe("DateWidget — datetime", () => {
  test("renders a datetime-local input", () => {
    const { container } = render(
      <DateWidget
        {...base}
        field={fields.datetime()}
        value="2026-05-21T10:30:00.000Z"
        onChange={() => {}}
      />,
    );
    expect((container.querySelector("input") as HTMLInputElement).type).toBe("datetime-local");
  });

  test("normalizes local input to an ISO 8601 string with offset", () => {
    const onChange = mock();
    const { container } = render(
      <DateWidget {...base} field={fields.datetime()} value={undefined} onChange={onChange} />,
    );
    fireEvent.change(container.querySelector("input") as HTMLInputElement, {
      target: { value: "2026-05-21T10:30" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0]?.[0] as string;
    // toISOString() always yields a UTC `…Z` instant — TZ-independent assertion.
    expect(emitted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test("emits undefined when cleared", () => {
    const onChange = mock();
    const { container } = render(
      <DateWidget
        {...base}
        field={fields.datetime()}
        value="2026-05-21T10:30:00.000Z"
        onChange={onChange}
      />,
    );
    fireEvent.change(container.querySelector("input") as HTMLInputElement, {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
