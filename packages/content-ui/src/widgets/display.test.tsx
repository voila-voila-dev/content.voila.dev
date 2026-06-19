import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { FieldMetaBase } from "@voila/content";
import {
  BooleanDisplay,
  DateDisplay,
  JsonDisplay,
  MultilineTextDisplay,
  NumberDisplay,
  RichTextValueDisplay,
  TextDisplay,
} from "./display";

function meta(kind: string): FieldMetaBase {
  return { kind };
}

describe("TextDisplay", () => {
  test("renders the string value", () => {
    const { container } = render(<TextDisplay value="hello" meta={meta("string")} />);
    expect(container.textContent).toBe("hello");
  });

  test("renders an em-dash for empty values", () => {
    for (const v of [null, undefined, ""]) {
      const { container } = render(<TextDisplay value={v} meta={meta("string")} />);
      expect(container.textContent).toBe("—");
    }
  });
});

describe("MultilineTextDisplay", () => {
  test("keeps line breaks instead of collapsing them", () => {
    const { container } = render(
      <MultilineTextDisplay value={"# Title\n\nBody"} meta={meta("markdown")} />,
    );
    const span = container.querySelector("span") as HTMLSpanElement;
    expect(span.textContent).toBe("# Title\n\nBody");
    expect(span.className).toContain("whitespace-pre-wrap");
  });

  test("renders an em-dash for empty values", () => {
    for (const v of [null, undefined, ""]) {
      const { container } = render(<MultilineTextDisplay value={v} meta={meta("markdown")} />);
      expect(container.textContent).toBe("—");
    }
  });
});

describe("NumberDisplay", () => {
  test("formats numbers with locale grouping", () => {
    const { container } = render(<NumberDisplay value={1234} meta={meta("number")} />);
    expect(container.textContent).toBe((1234).toLocaleString());
  });

  test("coerces numeric strings", () => {
    const { container } = render(<NumberDisplay value="42" meta={meta("number")} />);
    expect(container.textContent).toBe((42).toLocaleString());
  });

  test("renders an em-dash for non-numeric / null", () => {
    expect(render(<NumberDisplay value="x" meta={meta("number")} />).container.textContent).toBe(
      "—",
    );
    expect(render(<NumberDisplay value={null} meta={meta("number")} />).container.textContent).toBe(
      "—",
    );
  });
});

describe("BooleanDisplay", () => {
  test("renders Yes / No", () => {
    expect(
      render(<BooleanDisplay value={true} meta={meta("boolean")} />).container.textContent,
    ).toBe("Yes");
    expect(
      render(<BooleanDisplay value={false} meta={meta("boolean")} />).container.textContent,
    ).toBe("No");
  });

  test("renders an em-dash when null", () => {
    expect(
      render(<BooleanDisplay value={null} meta={meta("boolean")} />).container.textContent,
    ).toBe("—");
  });

  test("uses muted badge variants, never the solid primary", () => {
    const yes = render(<BooleanDisplay value={true} meta={meta("boolean")} />).container;
    const no = render(<BooleanDisplay value={false} meta={meta("boolean")} />).container;
    expect(yes.querySelector(".bg-secondary")).not.toBeNull();
    expect(yes.querySelector(".bg-primary")).toBeNull();
    expect(no.querySelector(".bg-primary")).toBeNull();
  });
});

describe("DateDisplay", () => {
  test("formats a Date as a <time> with an ISO dateTime", () => {
    const d = new Date("2026-06-08T10:30:00.000Z");
    const { container } = render(<DateDisplay value={d} meta={meta("datetime")} />);
    const time = container.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe(d.toISOString());
  });

  test("uses date-only formatting for the date kind", () => {
    const d = new Date("2026-06-08T10:30:00.000Z");
    const { container } = render(<DateDisplay value={d} meta={meta("date")} />);
    expect(container.querySelector("time")?.textContent).toBe(d.toLocaleDateString());
  });

  test("accepts epoch milliseconds and ISO strings", () => {
    const d = new Date("2026-06-08T10:30:00.000Z");
    expect(
      render(<DateDisplay value={d.getTime()} meta={meta("datetime")} />)
        .container.querySelector("time")
        ?.getAttribute("dateTime"),
    ).toBe(d.toISOString());
  });

  test("renders an em-dash for invalid / empty dates", () => {
    expect(render(<DateDisplay value={null} meta={meta("datetime")} />).container.textContent).toBe(
      "—",
    );
    expect(
      render(<DateDisplay value="not-a-date" meta={meta("datetime")} />).container.textContent,
    ).toBe("—");
  });
});

describe("RichTextValueDisplay", () => {
  test("flattens a node tree to plain text, blocks space-joined", () => {
    const value = [
      { id: "1", type: "heading-1", children: [{ text: "Title" }] },
      {
        id: "2",
        type: "paragraph",
        children: [{ text: "Hello " }, { text: "world", bold: true }],
      },
    ];
    const { container } = render(<RichTextValueDisplay value={value} meta={meta("richText")} />);
    expect(container.textContent).toBe("Title Hello world");
    expect(container.querySelector("span")?.className).toContain("whitespace-pre-wrap");
  });

  test("renders an em-dash for non-array / empty documents", () => {
    expect(
      render(<RichTextValueDisplay value={null} meta={meta("richText")} />).container.textContent,
    ).toBe("—");
    expect(
      render(
        <RichTextValueDisplay
          value={[{ id: "1", type: "paragraph", children: [{ text: "" }] }]}
          meta={meta("richText")}
        />,
      ).container.textContent,
    ).toBe("—");
  });
});

describe("JsonDisplay", () => {
  test("joins arrays with commas", () => {
    const { container } = render(<JsonDisplay value={["a", "b"]} meta={meta("array")} />);
    expect(container.textContent).toBe("a, b");
  });

  test("stringifies objects in arrays", () => {
    const { container } = render(<JsonDisplay value={[{ x: 1 }]} meta={meta("array")} />);
    expect(container.textContent).toBe('{"x":1}');
  });

  test("stringifies plain objects", () => {
    const { container } = render(<JsonDisplay value={{ a: 1 }} meta={meta("json")} />);
    expect(container.textContent).toBe('{"a":1}');
  });

  test("renders an em-dash for empty values and empty arrays", () => {
    expect(render(<JsonDisplay value={null} meta={meta("json")} />).container.textContent).toBe(
      "—",
    );
    expect(render(<JsonDisplay value={[]} meta={meta("array")} />).container.textContent).toBe("—");
  });

  test("stringifies primitives", () => {
    expect(render(<JsonDisplay value={5} meta={meta("json")} />).container.textContent).toBe("5");
  });
});
