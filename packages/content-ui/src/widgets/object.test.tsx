import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fields } from "@voila/content";
import { ObjectDisplay, ObjectInput } from "./object";

afterEach(cleanup);

const seo = fields.object({
  title: fields.string({ required: true, max: 60 }),
  description: fields.string(),
});

describe("ObjectInput", () => {
  test("renders one labelled input per member and emits the whole record", () => {
    const onChange = mock();
    render(<ObjectInput value={{ title: "T" }} onChange={onChange} field={seo} id="seo" />);
    const title = screen.getByLabelText(/Title/) as HTMLInputElement;
    expect(title.id).toBe("seo-title");
    expect(title.value).toBe("T");
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "D" } });
    expect(onChange).toHaveBeenCalledWith({ title: "T", description: "D" });
  });

  test("emits undefined once every member is blank", () => {
    const onChange = mock();
    render(<ObjectInput value={{ title: "T" }} onChange={onChange} field={seo} id="seo" />);
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test("places a nested issue under its member", () => {
    render(
      <ObjectInput
        value={{}}
        onChange={mock()}
        field={seo}
        id="seo"
        issues={[{ path: ["title"], message: "Required." }]}
      />,
    );
    expect(document.getElementById("seo-title-error")?.textContent).toBe("Required.");
  });

  test("lays a handful of short scalars out inline, long-form members stacked", () => {
    const link = fields.object({ label: fields.string({ max: 60 }), href: fields.string() });
    const { container, rerender } = render(
      <ObjectInput value={{}} onChange={mock()} field={link} id="l" />,
    );
    expect(container.querySelector("[data-slot=object-input]")?.getAttribute("data-layout")).toBe(
      "inline",
    );
    expect(container.querySelector("[data-slot=nested-fields]")?.className).toContain(
      "sm:grid-cols-2",
    );
    const body = fields.object({ title: fields.string(), body: fields.richText() });
    rerender(<ObjectInput value={{}} onChange={mock()} field={body} id="b" />);
    expect(container.querySelector("[data-slot=object-input]")?.getAttribute("data-layout")).toBe(
      "stacked",
    );
  });

  test("falls back to the unsupported notice without a shape", () => {
    const bare = { ...seo, meta: { kind: "object", widget: "object", keys: [] } } as never;
    const { container } = render(<ObjectInput value={{}} onChange={mock()} field={bare} id="o" />);
    expect(container.querySelector("[data-slot=unsupported-input]")).not.toBeNull();
  });
});

describe("ObjectDisplay", () => {
  test("previews scalar members compactly and rows in detail", () => {
    const { container, rerender } = render(
      <ObjectDisplay value={{ title: "T", description: "D" }} meta={seo.meta} context="cell" />,
    );
    expect(container.textContent).toBe("Title: T · Description: D");
    rerender(<ObjectDisplay value={{ title: "T" }} meta={seo.meta} context="detail" />);
    expect(container.querySelector("[data-slot=nested-display]")).not.toBeNull();
    rerender(<ObjectDisplay value={undefined} meta={seo.meta} context="detail" />);
    expect(container.querySelector("[data-slot=empty-display]")).not.toBeNull();
  });
});
