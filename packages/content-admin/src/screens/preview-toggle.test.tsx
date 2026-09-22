// PreviewToggle + the open/closed memory behind it. The behaviour worth
// pinning: the button announces its state and flips it, the choice survives
// a revisit per slug, and — the one that matters to an editor — hiding the
// pane keeps the form mounted, so a half-typed value is not lost.

import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { PreviewSplit, readPreviewOpen, usePreviewToggle, writePreviewOpen } from "./preview-split";
import { PreviewToggle } from "./preview-toggle";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("preview open memory", () => {
  test("defaults to open, remembers per slug, ignores junk", () => {
    expect(readPreviewOpen("pages")).toBe(true);
    expect(readPreviewOpen("pages", false)).toBe(false);
    writePreviewOpen("pages", false);
    expect(readPreviewOpen("pages")).toBe(false);
    expect(readPreviewOpen("posts")).toBe(true);
    localStorage.setItem("voila:preview-open:pages", "maybe");
    expect(readPreviewOpen("pages")).toBe(true);
  });

  test("usePreviewToggle initialises from storage and persists changes", () => {
    writePreviewOpen("pages", false);
    const { result } = renderHook(() => usePreviewToggle("pages"));
    expect(result.current.open).toBe(false);
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
    expect(readPreviewOpen("pages", false)).toBe(true);
  });
});

describe("PreviewToggle", () => {
  test("announces its state and flips it", () => {
    const onOpenChange = mock();
    const { rerender } = render(<PreviewToggle open={false} onOpenChange={onOpenChange} />);
    const button = screen.getByRole("button", { name: "Show preview" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(button);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    rerender(<PreviewToggle open onOpenChange={onOpenChange} />);
    expect(screen.getByRole("button", { name: "Hide preview" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
});

/** A stand-in form: local state that a remount would reset. */
function Typed() {
  const [text, setText] = useState("");
  return <input aria-label="Title" value={text} onChange={(e) => setText(e.target.value)} />;
}

describe("PreviewSplit open", () => {
  const target = { url: () => "/preview/pages" };

  test("hides the pane when closed and keeps the document mounted across a toggle", () => {
    const { container, rerender } = render(
      <PreviewSplit slug="pages" target={target} open={false} doc={{}}>
        <Typed />
      </PreviewSplit>,
    );
    expect(container.querySelector("[data-slot=preview-split]")?.getAttribute("data-state")).toBe(
      "closed",
    );
    expect(container.querySelector("[data-slot=preview-pane]")).toBeNull();
    const input = screen.getByLabelText("Title") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Draft title" } });
    rerender(
      <PreviewSplit slug="pages" target={target} open doc={{}}>
        <Typed />
      </PreviewSplit>,
    );
    expect(container.querySelector("[data-slot=preview-split]")?.getAttribute("data-state")).toBe(
      "open",
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Draft title");
    rerender(
      <PreviewSplit slug="pages" target={target} open={false} doc={{}}>
        <Typed />
      </PreviewSplit>,
    );
    expect(container.querySelector("[data-slot=preview-pane]")).toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Draft title");
  });
});
