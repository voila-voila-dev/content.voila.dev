import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fields } from "@voila/content";
import { ArrayDisplay, ArrayInput, arrayItems, moveItem } from "./array";

afterEach(cleanup);

const tags = fields.array(fields.string({ max: 10 }), { min: 1, max: 3 });

describe("helpers", () => {
  test("arrayItems and moveItem", () => {
    expect(arrayItems("x")).toEqual([]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
});

describe("ArrayInput", () => {
  test("renders the item widget per entry and emits a fresh array on edit", () => {
    const onChange = mock();
    render(<ArrayInput value={["a", "b"]} onChange={onChange} field={tags} id="t" />);
    const second = document.getElementById("t-1") as HTMLInputElement;
    expect(second.value).toBe("b");
    fireEvent.change(second, { target: { value: "c" } });
    expect(onChange).toHaveBeenCalledWith(["a", "c"]);
  });

  test("adds, moves and removes items within min / max", () => {
    const onChange = mock();
    render(<ArrayInput value={["a", "b"]} onChange={onChange} field={tags} id="t" />);
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b", undefined]);
    fireEvent.click(screen.getByRole("button", { name: "Move item 1 down" }));
    expect(onChange).toHaveBeenLastCalledWith(["b", "a"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 2" }));
    expect(onChange).toHaveBeenLastCalledWith(["a"]);
  });

  test("disables add at max and remove at min; last removal emits undefined", () => {
    const onChange = mock();
    const { rerender } = render(
      <ArrayInput value={["a", "b", "c"]} onChange={onChange} field={tags} id="t" />,
    );
    expect((screen.getByRole("button", { name: /Limit of 3/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    rerender(<ArrayInput value={["a"]} onChange={onChange} field={tags} id="t" />);
    expect(
      (screen.getByRole("button", { name: "Remove item 1" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const free = fields.array(fields.string());
    rerender(<ArrayInput value={["a"]} onChange={onChange} field={free} id="t" />);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  test("shows an item's issue under it", () => {
    render(
      <ArrayInput
        value={["a", "toolongvalue"]}
        onChange={mock()}
        field={tags}
        id="t"
        issues={[{ path: [1], message: "Too long." }]}
      />,
    );
    expect(document.getElementById("t-1-error")?.textContent).toBe("Too long.");
  });

  test("falls back to the unsupported notice for a bare-validator item", () => {
    const bare = { ...tags, meta: { kind: "array", widget: "array" } } as never;
    const { container } = render(<ArrayInput value={[]} onChange={mock()} field={bare} id="t" />);
    expect(container.querySelector("[data-slot=unsupported-input]")).not.toBeNull();
  });
});

const links = fields.array(
  fields.object({ label: fields.string({ max: 60 }), href: fields.string({ max: 200 }) }),
  { max: 3 },
);
const twoLinks = [
  { label: "Home", href: "/" },
  { label: "Blog", href: "/blog" },
];

describe("ArrayInput of objects", () => {
  test("renders collapsed cards headed by the first text member, members inline", () => {
    const { container } = render(
      <ArrayInput value={twoLinks} onChange={mock()} field={links} id="nav" />,
    );
    expect(container.querySelector("[data-slot=array-input]")?.getAttribute("data-layout")).toBe(
      "cards",
    );
    expect(screen.getAllByRole("button", { name: /^Expand item/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Expand item 2: Item 2" }).textContent).toContain(
      "Blog",
    );
    expect(document.getElementById("nav-0-label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand item 1: Item 1" }));
    const label = document.getElementById("nav-0-label") as HTMLInputElement;
    expect(label.value).toBe("Home");
    expect(container.querySelector("[data-slot=nested-fields]")?.getAttribute("data-layout")).toBe(
      "inline",
    );
  });

  test("edits a member through the card and emits the whole array", () => {
    const onChange = mock();
    render(<ArrayInput value={twoLinks} onChange={onChange} field={links} id="nav" />);
    fireEvent.click(screen.getByRole("button", { name: "Expand item 2: Item 2" }));
    fireEvent.change(document.getElementById("nav-1-href") as HTMLInputElement, {
      target: { value: "/news" },
    });
    expect(onChange).toHaveBeenLastCalledWith([twoLinks[0], { label: "Blog", href: "/news" }]);
  });

  test("adds an item expanded and focused, moves, drags and removes", () => {
    const onChange = mock();
    render(<ArrayInput value={twoLinks} onChange={onChange} field={links} id="nav" />);
    fireEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(onChange).toHaveBeenLastCalledWith([...twoLinks, undefined]);
    fireEvent.click(screen.getByRole("button", { name: "Move item 2 up" }));
    expect(onChange).toHaveBeenLastCalledWith([twoLinks[1], twoLinks[0]]);
    const rows = screen.getAllByRole("listitem");
    fireEvent.dragStart(rows[1] as HTMLElement, {
      dataTransfer: { setData: mock(), effectAllowed: "" },
    });
    fireEvent.drop(rows[0] as HTMLElement, { dataTransfer: { getData: () => "1" } });
    expect(onChange).toHaveBeenLastCalledWith([twoLinks[1], twoLinks[0]]);
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenLastCalledWith([twoLinks[1]]);
  });

  test("force-expands a card carrying an issue", () => {
    render(
      <ArrayInput
        value={twoLinks}
        onChange={mock()}
        field={links}
        id="nav"
        issues={[{ path: [1, "href"], message: "Bad link." }]}
      />,
    );
    expect(document.getElementById("nav-0-href")).toBeNull();
    expect(document.getElementById("nav-1-href-error")?.textContent).toBe("Bad link.");
    expect(screen.getByLabelText("Has errors")).toBeDefined();
  });
});

describe("ArrayDisplay", () => {
  test("joins scalars compactly, counts objects, lists items in detail", () => {
    const { container, rerender } = render(
      <ArrayDisplay value={["a", "b", "c", "d"]} meta={tags.meta} context="cell" />,
    );
    expect(container.textContent).toBe("a, b, c, +1");
    const objs = fields.array(fields.object({ q: fields.string() }));
    rerender(<ArrayDisplay value={[{ q: "x" }, { q: "y" }]} meta={objs.meta} context="cell" />);
    expect(container.textContent).toBe("2 items");
    rerender(<ArrayDisplay value={["a", "b"]} meta={tags.meta} context="detail" />);
    expect(container.querySelectorAll("li").length).toBe(2);
    rerender(<ArrayDisplay value={[]} meta={tags.meta} context="detail" />);
    expect(container.querySelector("[data-slot=empty-display]")).not.toBeNull();
  });
});
