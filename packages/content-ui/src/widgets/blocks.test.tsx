import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fields } from "@voila/content";
import { EditRegistryProvider } from "../registry/context";
import { mergeEditRegistry } from "../registry/edit";
import { BlocksDisplay, BlocksInput, blankBlock, blockSummary, blocksValue } from "./blocks";
import type { EditWidgetProps } from "./edit";

afterEach(cleanup);

const page = fields.blocks({
  max: 3,
  types: {
    hero: {
      label: "Hero",
      icon: "Sparkle",
      description: "Big title",
      fields: {
        title: fields.string({ required: true, max: 40, defaultValue: "Untitled" }),
        body: fields.markdown(),
      },
    },
    faq: { fields: { question: fields.string() } },
  },
});
const single = fields.blocks({ types: { note: { fields: { text: fields.string() } } } });

const twoBlocks = [
  { type: "hero", title: "Welcome home" },
  { type: "faq", question: "Why?" },
];

describe("helpers", () => {
  test("blocksValue keeps only records; blankBlock seeds defaults; blockSummary reads the first text", () => {
    expect(blocksValue([{ type: "a" }, "junk", null, 3])).toEqual([{ type: "a" }]);
    expect(blocksValue("nope")).toEqual([]);
    expect(blankBlock("hero", page.meta.types.hero as never)).toEqual({
      type: "hero",
      title: "Untitled",
    });
    expect(blockSummary({ type: "hero", title: "  Hi  " }, page.meta.types.hero)).toBe("Hi");
    expect(blockSummary({ type: "hero" }, page.meta.types.hero)).toBeUndefined();
    expect(blockSummary({ type: "x" }, undefined)).toBeUndefined();
  });
});

describe("BlocksInput", () => {
  test("renders one card per block with its type label and summary, fields collapsed", () => {
    render(<BlocksInput value={twoBlocks} onChange={mock()} field={page} id="b" />);
    expect(screen.getByText("Hero")).toBeDefined();
    expect(screen.getByText("Welcome home")).toBeDefined();
    // The faq type has no label: humanized key.
    expect(screen.getByText("Faq")).toBeDefined();
    expect(document.getElementById("b-0-title")).toBeNull();
  });

  test("expands a card to edit its fields through the registry in scope", () => {
    const onChange = mock();
    const Custom = ({ id, value, onChange: emit }: EditWidgetProps) => (
      <input
        id={id}
        data-custom
        value={String(value ?? "")}
        onChange={(e) => emit(e.target.value)}
      />
    );
    render(
      <EditRegistryProvider registry={mergeEditRegistry({ string: Custom })}>
        <BlocksInput value={twoBlocks} onChange={onChange} field={page} id="b" />
      </EditRegistryProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Expand block 1/ }));
    const title = document.getElementById("b-0-title") as HTMLInputElement;
    expect(title.hasAttribute("data-custom")).toBe(true);
    expect(title.value).toBe("Welcome home");
    fireEvent.change(title, { target: { value: "Changed" } });
    expect(onChange).toHaveBeenCalledWith([
      { type: "hero", title: "Changed" },
      { type: "faq", question: "Why?" },
    ]);
  });

  test("adds a block from the single-type button, seeded with defaults, expanded", () => {
    const onChange = mock();
    render(<BlocksInput value={undefined} onChange={onChange} field={single} id="s" />);
    fireEvent.click(screen.getByRole("button", { name: "Add block" }));
    expect(onChange).toHaveBeenCalledWith([{ type: "note" }]);
  });

  test("offers the catalogue in a menu and appends the picked type", async () => {
    const onChange = mock();
    render(<BlocksInput value={twoBlocks} onChange={onChange} field={page} id="b" />);
    fireEvent.click(screen.getByRole("button", { name: "Add block" }));
    const item = await screen.findByRole("menuitem", { name: /Hero/ });
    expect(item.textContent).toContain("Big title");
    fireEvent.click(item);
    expect(onChange).toHaveBeenCalledWith([...twoBlocks, { type: "hero", title: "Untitled" }]);
  });

  test("disables adding at max", () => {
    render(
      <BlocksInput value={[...twoBlocks, { type: "faq" }]} onChange={mock()} field={page} id="b" />,
    );
    const add = screen.getByRole("button", { name: /Limit of 3 reached/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });

  test("moves and removes blocks; removing the last emits undefined", () => {
    const onChange = mock();
    const { rerender } = render(
      <BlocksInput value={twoBlocks} onChange={onChange} field={page} id="b" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move block 2 up" }));
    expect(onChange).toHaveBeenLastCalledWith([twoBlocks[1], twoBlocks[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Move block 1 down" }));
    expect(onChange).toHaveBeenLastCalledWith([twoBlocks[1], twoBlocks[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Remove block 1" }));
    expect(onChange).toHaveBeenLastCalledWith([twoBlocks[1]]);
    rerender(<BlocksInput value={[twoBlocks[1]]} onChange={onChange} field={page} id="b" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove block 1" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  test("surfaces a nested issue under its control and force-expands the card", () => {
    render(
      <BlocksInput
        value={[{ type: "hero" }]}
        onChange={mock()}
        field={page}
        id="b"
        error="[0].title: Required."
        issues={[{ path: [0, "title"], message: "Required." }]}
      />,
    );
    expect(document.getElementById("b-0-title")).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Required.");
    expect(screen.getByLabelText("Has errors")).toBeDefined();
  });

  test("keeps an unknown block type inert but removable", () => {
    render(<BlocksInput value={[{ type: "gone", x: 1 }]} onChange={mock()} field={page} id="b" />);
    expect(screen.getByText(/Unknown block type “gone”/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Expand block 1/ }));
    expect(screen.getByText(/no longer in the catalogue/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Remove block 1" })).toBeDefined();
  });
});

describe("BlocksDisplay", () => {
  test("summarizes on compact surfaces and renders rows in detail", () => {
    const { container, rerender } = render(
      <BlocksDisplay value={twoBlocks} meta={page.meta} context="cell" />,
    );
    expect(container.textContent).toBe("2 blocks: Hero, Faq");
    rerender(<BlocksDisplay value={twoBlocks} meta={page.meta} context="detail" />);
    expect(container.querySelectorAll("[data-slot=nested-display]").length).toBe(2);
    expect(container.textContent).toContain("Welcome home");
    rerender(<BlocksDisplay value={[]} meta={page.meta} context="cell" />);
    expect(container.querySelector("[data-slot=empty-display]")).not.toBeNull();
  });
});
