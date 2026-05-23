import { describe, expect, test } from "bun:test";
import { fields } from "@voila/content-schema";
import { renderToStaticMarkup } from "react-dom/server";
import { formatFieldValue, ReadOnlyField } from "./field-display.tsx";

describe("formatFieldValue", () => {
  test("renders boolean as Yes / No / em-dash", () => {
    expect(formatFieldValue(fields.boolean(), true)).toBe("Yes");
    expect(formatFieldValue(fields.boolean(), false)).toBe("No");
    expect(formatFieldValue(fields.boolean(), null)).toBe("—");
  });

  test("renders datetime as locale string", () => {
    const out = formatFieldValue(fields.datetime(), new Date(0));
    expect(typeof out).toBe("string");
    expect(out).not.toBe("Invalid Date");
  });

  test("falls back to em-dash for null/empty", () => {
    expect(formatFieldValue(fields.string(), null)).toBe("—");
    expect(formatFieldValue(fields.string(), "")).toBe("—");
  });
});

describe("ReadOnlyField", () => {
  test("renders the field label + value", () => {
    const html = renderToStaticMarkup(
      <ReadOnlyField field={fields.string({ label: "Title" })} name="title" value="Hello" />,
    );
    expect(html).toContain("Title");
    expect(html).toContain("Hello");
  });

  test("falls back to the field name when no label is set", () => {
    const html = renderToStaticMarkup(
      <ReadOnlyField field={fields.string()} name="title" value="Hi" />,
    );
    expect(html).toContain("title");
  });
});
