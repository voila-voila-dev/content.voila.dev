import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { fields } from "@voila/content";
import { FieldRenderer } from "./field-renderer";
import { mergeRegistry } from "./registry/registry";

describe("FieldRenderer", () => {
  test("renders a value via the widget resolved from the field kind", () => {
    const { container } = render(<FieldRenderer field={fields.number()} value={1000} />);
    expect(container.textContent).toBe((1000).toLocaleString());
  });

  test("honors a custom registry keyed by the field's widget name", () => {
    // `fields.string` sets meta.widget = "string"; override that name.
    const Loud = ({ value }: { value: unknown }) => <strong>{String(value).toUpperCase()}</strong>;
    const { container } = render(
      <FieldRenderer
        field={fields.string()}
        value="hi"
        registry={mergeRegistry({ string: Loud })}
      />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("HI");
  });
});
