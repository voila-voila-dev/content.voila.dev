import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { fields } from "@voila/content-schema";
import { SlugWidget } from "./slug-widget.tsx";

afterEach(cleanup);

const base = { id: "f", name: "slug" } as const;

describe("SlugWidget", () => {
  test("auto-derives from the source field when empty", () => {
    const onChange = mock();
    render(
      <SlugWidget
        {...base}
        field={fields.slug({ from: "title" })}
        value={undefined}
        onChange={onChange}
        doc={{ title: "Hello World" }}
      />,
    );
    expect(onChange).toHaveBeenCalledWith("hello-world");
  });

  test("does not derive over a pre-filled value (existing record)", () => {
    const onChange = mock();
    render(
      <SlugWidget
        {...base}
        field={fields.slug({ from: "title" })}
        value="original-slug"
        onChange={onChange}
        doc={{ title: "A Brand New Title" }}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  test("slugifies manual input", () => {
    const onChange = mock();
    const { container } = render(
      <SlugWidget {...base} field={fields.slug()} value="" onChange={onChange} />,
    );
    fireEvent.change(container.querySelector("input") as HTMLInputElement, {
      target: { value: "My Custom Slug" },
    });
    expect(onChange).toHaveBeenLastCalledWith("my-custom-slug");
  });

  test("trims a trailing separator on blur", () => {
    const onChange = mock();
    const { container } = render(
      <SlugWidget {...base} field={fields.slug()} value="foo-" onChange={onChange} />,
    );
    fireEvent.blur(container.querySelector("input") as HTMLInputElement);
    expect(onChange).toHaveBeenCalledWith("foo");
  });
});
