import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { fields } from "@voila/content";
import {
  BooleanInput,
  DateInput,
  MonospaceTextareaInput,
  NumberInput,
  SelectInput,
  selectOptions,
  TextareaInput,
  TextInput,
  UnsupportedInput,
} from "./edit";

afterEach(cleanup);

describe("TextareaInput", () => {
  test("renders the value in a textarea and emits string changes", () => {
    const onChange = mock();
    const { container } = render(
      <TextareaInput value="body" onChange={onChange} field={fields.markdown()} id="m" />,
    );
    const ta = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(ta.value).toBe("body");
    fireEvent.change(ta, { target: { value: "more" } });
    expect(onChange).toHaveBeenCalledWith("more");
  });
});

describe("MonospaceTextareaInput", () => {
  test("renders a tall monospace textarea and emits string changes", () => {
    const onChange = mock();
    const { container } = render(
      <MonospaceTextareaInput
        value={"# Title\n\nBody"}
        onChange={onChange}
        field={fields.markdown()}
        id="m"
      />,
    );
    const ta = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(ta.value).toBe("# Title\n\nBody");
    expect(ta.className).toContain("font-mono");
    expect(ta.className).toContain("min-h-40");
    fireEvent.change(ta, { target: { value: "more" } });
    expect(onChange).toHaveBeenCalledWith("more");
  });

  test("renders empty for a non-string value", () => {
    const { container } = render(
      <MonospaceTextareaInput
        value={undefined}
        onChange={mock()}
        field={fields.markdown()}
        id="m"
      />,
    );
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
  });
});

describe("UnsupportedInput", () => {
  test("renders a read-only note naming the kind", () => {
    const { container } = render(
      <UnsupportedInput
        value={[]}
        onChange={mock()}
        field={fields.array(fields.string())}
        id="a"
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toContain("array");
    expect(input.disabled).toBe(true);
  });

  test("advertises the rich-text-editor item for richText fields", () => {
    const { container } = render(
      <UnsupportedInput value={[]} onChange={mock()} field={fields.richText()} id="b" />,
    );
    expect((container.querySelector("input") as HTMLInputElement).value).toContain(
      "voila add rich-text-editor",
    );
  });
});

describe("TextInput", () => {
  test("renders the string value and emits string changes", () => {
    const onChange = mock();
    const { container } = render(
      <TextInput value="hi" onChange={onChange} field={fields.string()} id="f" />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("hi");
    fireEvent.change(input, { target: { value: "there" } });
    expect(onChange).toHaveBeenCalledWith("there");
  });

  test("wires aria-invalid + describedby when an error is present", () => {
    const { container } = render(
      <TextInput value="" onChange={mock()} field={fields.string()} id="f" error="Required." />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("f-error");
  });
});

describe("NumberInput", () => {
  test("emits a number, or undefined when cleared", () => {
    const onChange = mock();
    const { container } = render(
      <NumberInput value={3} onChange={onChange} field={fields.number()} id="n" />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("number");
    fireEvent.change(input, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith(42);
    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});

describe("BooleanInput", () => {
  test("reflects the checked state and toggles", () => {
    const onChange = mock();
    const { getByRole } = render(
      <BooleanInput value={true} onChange={onChange} field={fields.boolean()} id="b" />,
    );
    const sw = getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test("is named by the labelling element via aria-labelledby", () => {
    // Base UI puts `id` on the hidden checkbox, so `htmlFor` alone can't name
    // the visible switch — the widget must reference the label element itself.
    const { getByRole } = render(
      <>
        <span id="b-label">Published</span>
        <BooleanInput
          value={false}
          onChange={mock()}
          field={fields.boolean()}
          id="b"
          labelId="b-label"
        />
      </>,
    );
    expect(getByRole("switch", { name: "Published" }).getAttribute("aria-labelledby")).toBe(
      "b-label",
    );
  });
});

describe("SelectInput", () => {
  test("renders options from a select field and emits the chosen value", () => {
    const onChange = mock();
    const field = fields.select({ options: ["draft", "published"] });
    const { container } = render(
      <SelectInput value="draft" onChange={onChange} field={field} id="s" />,
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    // required defaults to false → a leading placeholder option is present.
    expect(select.querySelectorAll("option").length).toBe(3);
    fireEvent.change(select, { target: { value: "published" } });
    expect(onChange).toHaveBeenCalledWith("published");
  });

  test("maps an enum's numeric value back to its original type", () => {
    const onChange = mock();
    const field = fields.enum({ values: { Low: 1, High: 2 } });
    const { container } = render(
      <SelectInput value={1} onChange={onChange} field={field} id="e" />,
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith(2); // number, not "2"
  });

  test("omits the placeholder option when required", () => {
    const field = fields.select({ options: ["a"], required: true });
    const { container } = render(<SelectInput value="a" onChange={mock()} field={field} id="s" />);
    expect(container.querySelectorAll("option").length).toBe(1);
  });
});

describe("DateInput", () => {
  test("date kind round-trips the ISO string", () => {
    const onChange = mock();
    const { container } = render(
      <DateInput value="2026-06-08" onChange={onChange} field={fields.date()} id="d" />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("date");
    fireEvent.change(input, { target: { value: "2026-07-01" } });
    expect(onChange).toHaveBeenCalledWith("2026-07-01");
  });

  test("datetime kind emits a Date", () => {
    const onChange = mock();
    const { container } = render(
      <DateInput
        value={new Date("2026-06-08T10:30:00")}
        onChange={onChange}
        field={fields.datetime()}
        id="dt"
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("datetime-local");
    fireEvent.change(input, { target: { value: "2026-07-01T08:15" } });
    const arg = onChange.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(Date);
  });

  test("datetime kind displays the stored epoch-ms and wire ISO forms", () => {
    // REST reads return epoch ms; a JSON-echoed Date is an ISO string. Both
    // must render, or the edit form shows existing values as blank.
    const stored = new Date(2026, 5, 8, 10, 30);
    for (const value of [stored.getTime(), stored.toISOString()]) {
      const { container, unmount } = render(
        <DateInput value={value} onChange={mock()} field={fields.datetime()} id="dt" />,
      );
      const input = container.querySelector("input") as HTMLInputElement;
      expect(input.value).toBe("2026-06-08T10:30");
      unmount();
    }
  });

  test("datetime kind renders an unparseable value as empty", () => {
    const { container } = render(
      <DateInput value="not a date" onChange={mock()} field={fields.datetime()} id="dt" />,
    );
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("");
  });

  test("time kind asks for seconds precision", () => {
    const { container } = render(
      <DateInput value="09:00:00" onChange={mock()} field={fields.time()} id="t" />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("type")).toBe("time");
    expect(input.getAttribute("step")).toBe("1");
  });
});

describe("selectOptions", () => {
  test("returns empty for a non-option field", () => {
    expect(selectOptions(fields.string().meta)).toEqual([]);
  });
});
