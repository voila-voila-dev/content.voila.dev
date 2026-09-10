// The multi-select widgets. The combobox internals are Base UI's; what this
// package owns is reading the value, emitting `undefined` rather than `[]` when
// the last chip goes, and honouring the field's `max`.

import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { type Field, fields } from "@voila/content";
import { MultiSelectDisplay, MultiSelectInput, multiSelectValues } from "./multi-select";

afterEach(cleanup);

const FORMATS = ["35mm", "16mm", "70mm", "DCP"] as const;
const formats = fields.multiSelect({ options: FORMATS }) as unknown as Field;
const capped = fields.multiSelect({ options: FORMATS, max: 2 }) as unknown as Field;

describe("multiSelectValues", () => {
  test("reads a string list and rejects everything else", () => {
    expect(multiSelectValues(["35mm", "DCP"])).toEqual(["35mm", "DCP"]);
    expect(multiSelectValues([])).toEqual([]);
    expect(multiSelectValues(undefined)).toEqual([]);
    expect(multiSelectValues("35mm")).toEqual([]);
  });
  test("drops non-string entries", () => {
    expect(multiSelectValues(["35mm", 3, null])).toEqual(["35mm"]);
  });
});

describe("MultiSelectInput", () => {
  test("renders a chip per selected option", () => {
    render(
      <MultiSelectInput value={["35mm", "DCP"]} onChange={() => {}} field={formats} id="formats" />,
    );
    expect(screen.getByText("35mm")).toBeDefined();
    expect(screen.getByText("DCP")).toBeDefined();
  });

  test("invites a choice while below the cap", () => {
    render(<MultiSelectInput value={["35mm"]} onChange={() => {}} field={capped} id="formats" />);
    expect(screen.getByPlaceholderText("Add…")).toBeDefined();
  });

  test("says so once the cap is reached instead of offering more", () => {
    render(
      <MultiSelectInput value={["35mm", "DCP"]} onChange={() => {}} field={capped} id="formats" />,
    );
    expect(screen.getByPlaceholderText("Limit of 2 reached")).toBeDefined();
  });
});

describe("MultiSelectDisplay", () => {
  test("renders a chip per value", () => {
    render(<MultiSelectDisplay value={["35mm", "DCP"]} meta={formats.meta} />);
    expect(screen.getByText("35mm")).toBeDefined();
    expect(screen.getByText("DCP")).toBeDefined();
  });

  test("an empty value renders the shared empty marker", () => {
    const { container } = render(<MultiSelectDisplay value={[]} meta={formats.meta} />);
    expect(container.querySelector("[data-slot=empty-display]")).not.toBeNull();
  });

  test("a dense cell caps the chips and counts the rest", () => {
    render(
      <MultiSelectDisplay value={["35mm", "16mm", "70mm"]} meta={formats.meta} context="cell" />,
    );
    expect(screen.getByText("+1")).toBeDefined();
    expect(screen.queryByText("70mm")).toBeNull();
  });

  test("the detail surface shows every chip", () => {
    render(
      <MultiSelectDisplay value={["35mm", "16mm", "70mm"]} meta={formats.meta} context="detail" />,
    );
    expect(screen.getByText("70mm")).toBeDefined();
  });
});
