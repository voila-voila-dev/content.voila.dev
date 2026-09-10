// The relation widgets. The pure helpers and the id fallback are exercised
// directly; the combobox itself is Base UI's, so the tests here cover what this
// package owns — reading the value's arity, resolving ids to labels once the
// loader settles, and degrading honestly when there is nothing to load with.

import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type Field, fields } from "@voila/content";
import {
  createRelationDisplay,
  createRelationInput,
  RelationIdInput,
  type RelationOption,
  relationIds,
  shortId,
} from "./relation";

afterEach(cleanup);

// The loader resolves on a microtask after mount. Tests that assert on the
// pre-load frame still have to let that settle inside the test body, or React
// logs an "update not wrapped in act(...)" warning for the state that lands
// after the test returns.
async function settle(): Promise<void> {
  await act(async () => {});
}

const single = fields.relation({ to: "people" }) as unknown as Field;
const many = fields.relation({ to: "people", many: true }) as unknown as Field;

const PEOPLE: ReadonlyArray<RelationOption> = [
  { value: "p1", label: "Agnès Varda", hint: "agnes-varda" },
  { value: "p2", label: "Edward Yang", hint: "edward-yang" },
];

function loader() {
  return mock(async () => PEOPLE);
}

describe("relationIds", () => {
  test("reads a single id, a list, and nothing", () => {
    expect(relationIds("p1")).toEqual(["p1"]);
    expect(relationIds(["p1", "p2"])).toEqual(["p1", "p2"]);
    expect(relationIds("")).toEqual([]);
    expect(relationIds(undefined)).toEqual([]);
    expect(relationIds(null)).toEqual([]);
    expect(relationIds(42)).toEqual([]);
  });
  test("drops non-string entries rather than passing them through", () => {
    expect(relationIds(["p1", 7, null])).toEqual(["p1"]);
  });
});

describe("shortId", () => {
  test("elides the middle of a uuid but leaves a short id alone", () => {
    expect(shortId("cc1f491a-aa29-466f-84fc-d8d07cbefc35")).toBe("cc1f…fc35");
    expect(shortId("p1")).toBe("p1");
  });
});

describe("RelationIdInput", () => {
  test("shows the current ids and emits a trimmed value", () => {
    const onChange = mock(() => {});
    render(<RelationIdInput value="p1" onChange={onChange} field={single} id="rel" />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("p1");
    fireEvent.change(input, { target: { value: "  p2  " } });
    expect(onChange).toHaveBeenCalledWith("p2");
  });

  test("clearing the input clears the field", () => {
    const onChange = mock(() => {});
    render(<RelationIdInput value="p1" onChange={onChange} field={single} id="rel" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe("createRelationInput", () => {
  test("asks the loader for the field's target collection", async () => {
    const load = loader();
    const RelationInput = createRelationInput({ load });
    render(<RelationInput value={undefined} onChange={() => {}} field={single} id="rel" />);
    await waitFor(() => expect(load).toHaveBeenCalledWith("people"));
    await settle();
  });

  test("resolves the selected id to its label", async () => {
    const RelationInput = createRelationInput({ load: loader() });
    render(<RelationInput value="p2" onChange={() => {}} field={single} id="rel" />);
    await waitFor(() => {
      expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Edward Yang");
    });
  });

  test("a failed load falls back to the honest id input", async () => {
    const load = mock(async () => {
      throw new Error("offline");
    });
    const RelationInput = createRelationInput({ load });
    render(<RelationInput value="p1" onChange={() => {}} field={single} id="rel" />);
    await waitFor(() => {
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("p1");
    });
  });

  test("a field with no target never calls the loader", async () => {
    const load = loader();
    const RelationInput = createRelationInput({ load });
    const noTarget = { ...single, meta: { ...single.meta, to: undefined } } as unknown as Field;
    render(<RelationInput value="p1" onChange={() => {}} field={noTarget} id="rel" />);
    expect(load).not.toHaveBeenCalled();
    await settle();
  });

  test("a single relation offers a clear button that empties the field", async () => {
    const onChange = mock(() => {});
    const RelationInput = createRelationInput({ load: loader() });
    render(<RelationInput value="p1" onChange={onChange} field={single} id="rel" />);
    fireEvent.click(await screen.findByRole("button", { name: "Clear selection" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test("a disabled single relation hides the clear button", async () => {
    const RelationInput = createRelationInput({ load: loader() });
    render(<RelationInput value="p1" onChange={() => {}} field={single} id="rel" disabled />);
    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
    await settle();
  });

  test("a many relation renders one chip per selected id", async () => {
    const RelationInput = createRelationInput({ load: loader() });
    render(<RelationInput value={["p1", "p2"]} onChange={() => {}} field={many} id="rel" />);
    await waitFor(() => {
      expect(screen.getByText("Agnès Varda")).toBeDefined();
      expect(screen.getByText("Edward Yang")).toBeDefined();
    });
  });
});

describe("createRelationDisplay", () => {
  test("renders the resolved label, not the raw id", async () => {
    const RelationDisplay = createRelationDisplay({ load: loader() });
    render(<RelationDisplay value="p1" meta={single.meta} />);
    await waitFor(() => expect(screen.getByText("Agnès Varda")).toBeDefined());
  });

  test("falls back to a shortened id until the loader settles", async () => {
    const RelationDisplay = createRelationDisplay({ load: async () => [] });
    render(<RelationDisplay value="cc1f491a-aa29-466f-84fc-d8d07cbefc35" meta={single.meta} />);
    expect(screen.getByText("cc1f…fc35")).toBeDefined();
    await settle();
  });

  test("an empty value renders the shared empty marker", async () => {
    const RelationDisplay = createRelationDisplay({ load: loader() });
    const { container } = render(<RelationDisplay value={undefined} meta={single.meta} />);
    expect(container.querySelector("[data-slot=empty-display]")).not.toBeNull();
    await settle();
  });

  test("a dense cell caps the chips and counts the rest", async () => {
    const load = mock(async () => [...PEOPLE, { value: "p3", label: "Chantal Akerman" }]);
    const RelationDisplay = createRelationDisplay({ load });
    render(<RelationDisplay value={["p1", "p2", "p3"]} meta={many.meta} context="cell" />);
    await waitFor(() => expect(screen.getByText("+1")).toBeDefined());
    expect(screen.queryByText("Chantal Akerman")).toBeNull();
  });
});
