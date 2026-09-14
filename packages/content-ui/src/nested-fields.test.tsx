import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fields } from "@voila/content";
import { NestedDisplayRows, NestedFields, visibleKeys } from "./nested-fields";

afterEach(cleanup);

const shape = {
  title: fields.string({ required: true, max: 20 }),
  secret: fields.string({ hidden: true }),
  count: fields.number({ integer: true }),
};

describe("NestedFields", () => {
  test("renders visible fields with ids under the prefix and merges edits", () => {
    const onChange = mock();
    render(
      <NestedFields fields={shape} value={{ title: "A" }} onChange={onChange} idPrefix="p-0" />,
    );
    expect(visibleKeys(shape)).toEqual(["title", "count"]);
    expect(document.getElementById("p-0-secret")).toBeNull();
    fireEvent.change(document.getElementById("p-0-count") as HTMLInputElement, {
      target: { value: "3" },
    });
    expect(onChange).toHaveBeenCalledWith({ title: "A", count: 3 });
    expect(screen.getByText("1 / 20")).toBeDefined();
  });

  test("places issues by key", () => {
    render(
      <NestedFields
        fields={shape}
        value={{}}
        onChange={mock()}
        idPrefix="p"
        issues={[{ path: ["title"], message: "Required." }]}
      />,
    );
    expect(document.getElementById("p-title-error")?.textContent).toBe("Required.");
  });
});

describe("NestedDisplayRows", () => {
  test("renders a label → value list, skipping hidden fields", () => {
    const { container } = render(
      <NestedDisplayRows fields={shape} value={{ title: "A", count: 2 }} />,
    );
    expect(container.querySelectorAll("dt").length).toBe(2);
    expect(container.textContent).toContain("A");
    expect(container.textContent).toContain("2");
  });
});
