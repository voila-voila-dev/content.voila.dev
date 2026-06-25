import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { defineCollection, fields } from "@voila/content";
import type { ListFilter } from "@voila/content/client";
import { useState } from "react";
import { FilterBuilder } from "./filter-builder";

afterEach(cleanup);

const collection = defineCollection({
  slug: "posts",
  fields: {
    title: fields.string(),
    views: fields.number(),
    status: fields.enum({ values: { Draft: "draft", Published: "published" } }),
    active: fields.boolean(),
    location: fields.geo(), // JSON-backed → not filterable
    internal: fields.string({ hidden: true }), // hidden → not offered
  },
});

function open() {
  fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
}

// A properly controlled host: it echoes `onChange` back into `value`, exactly as
// the admin's list screen does. (The builder re-seeds its draft rows when the
// applied filters change from outside, so a static value would wipe a row after
// the first emit.)
function setup(initial: ReadonlyArray<ListFilter> = []) {
  const onChange = mock();
  function Wrapper() {
    const [value, setValue] = useState<ReadonlyArray<ListFilter>>(initial);
    return (
      <FilterBuilder
        collection={collection}
        value={value}
        onChange={(filters) => {
          onChange(filters);
          setValue(filters);
        }}
      />
    );
  }
  render(<Wrapper />);
  return { onChange };
}

describe("FilterBuilder", () => {
  test("offers only filterable scalar fields (no geo / hidden)", () => {
    setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    const fieldSelect = screen.getByLabelText("Filter field");
    const labels = within(fieldSelect)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual(["Title", "Views", "Status", "Active"]);
  });

  test("a half-typed row emits nothing; a value completes it", () => {
    const { onChange } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    // The row is added but its value is empty → no filter applied yet.
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.change(screen.getByLabelText("Filter value"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenLastCalledWith([{ field: "title", op: "eq", value: "hello" }]);
  });

  test("a number field coerces the value and offers comparisons", () => {
    const { onChange } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByLabelText("Filter field"), { target: { value: "views" } });
    const opLabels = within(screen.getByLabelText("Filter operator"))
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(opLabels).toContain("≥");
    fireEvent.change(screen.getByLabelText("Filter operator"), { target: { value: "gte" } });
    fireEvent.change(screen.getByLabelText("Filter value"), { target: { value: "10" } });
    expect(onChange).toHaveBeenLastCalledWith([{ field: "views", op: "gte", value: 10 }]);
  });

  test("an enum field is complete immediately (defaults to the first option)", () => {
    const { onChange } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByLabelText("Filter field"), { target: { value: "status" } });
    expect(onChange).toHaveBeenLastCalledWith([{ field: "status", op: "eq", value: "draft" }]);
  });

  test("a boolean field emits a real boolean value", () => {
    const { onChange } = setup();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByLabelText("Filter field"), { target: { value: "active" } });
    expect(onChange).toHaveBeenLastCalledWith([{ field: "active", op: "eq", value: true }]);
    fireEvent.change(screen.getByLabelText("Filter value"), { target: { value: "false" } });
    expect(onChange).toHaveBeenLastCalledWith([{ field: "active", op: "eq", value: false }]);
  });

  test("the trigger shows the applied filter count", () => {
    setup([{ field: "title", op: "eq", value: "x" }]);
    expect(screen.getByRole("button", { name: "Filters (1)" })).toBeDefined();
  });

  test("removing a seeded filter emits the remaining set", () => {
    const { onChange } = setup([{ field: "title", op: "contains", value: "news" }]);
    open();
    expect((screen.getByLabelText("Filter value") as HTMLInputElement).value).toBe("news");
    fireEvent.click(screen.getByRole("button", { name: "Remove filter" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
