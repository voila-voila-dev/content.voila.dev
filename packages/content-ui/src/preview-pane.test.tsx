import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  PREVIEW_DEBOUNCE_MS,
  PREVIEW_LISTENING,
  PREVIEW_MESSAGE,
  PREVIEW_READY,
  PreviewPane,
} from "./preview-pane";

afterEach(cleanup);

// The test document has no location (the shared setup strips it), so the pane
// is told its origin explicitly — the same prop a host could set.
const origin = "http://localhost:5173";

/** The frame's window as the pane sees it: `contentWindow.postMessage` is spied. */
function mountPane(doc: Record<string, unknown>, focus?: ReadonlyArray<string | number>) {
  const utils = render(
    <PreviewPane src="/preview/pages" doc={doc} focus={focus} origin={origin} />,
  );
  const frame = utils.container.querySelector("iframe") as HTMLIFrameElement;
  const posted = mock();
  // happy-dom gives the iframe a contentWindow; stand in its postMessage.
  const frameWindow = frame.contentWindow as Window;
  Object.defineProperty(frameWindow, "postMessage", { value: posted, configurable: true });
  const fromFrame = (data: unknown) =>
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, origin, source: frameWindow }));
    });
  return { ...utils, frame, posted, fromFrame, frameWindow };
}

const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("PreviewPane", () => {
  test("renders a sandboxed same-origin frame with the toolbar", () => {
    const { frame } = mountPane({ title: "A" });
    expect(frame.getAttribute("src")).toBe("/preview/pages");
    expect(frame.getAttribute("sandbox")).toContain("allow-same-origin");
    expect(screen.getByRole("button", { name: "Mobile width" })).toBeTruthy();
    expect(screen.getByLabelText("Open preview in a new tab").getAttribute("href")).toBe(
      "/preview/pages",
    );
  });

  test("posts the document once the frame announces itself, then on each change (debounced)", async () => {
    const { posted, fromFrame, rerender } = mountPane({ title: "A" });
    expect(posted).not.toHaveBeenCalled();
    fromFrame({ type: PREVIEW_LISTENING });
    expect(posted).toHaveBeenCalledTimes(1);
    expect(posted.mock.calls[0]?.[0]).toEqual({
      type: PREVIEW_MESSAGE,
      doc: { title: "A" },
      seq: 1,
    });
    expect(posted.mock.calls[0]?.[1]).toBe(origin);
    rerender(<PreviewPane src="/preview/pages" doc={{ title: "AB" }} origin={origin} />);
    rerender(<PreviewPane src="/preview/pages" doc={{ title: "ABC" }} origin={origin} />);
    expect(posted).toHaveBeenCalledTimes(1);
    await wait(PREVIEW_DEBOUNCE_MS + 30);
    expect(posted).toHaveBeenCalledTimes(2);
    expect(posted.mock.calls[1]?.[0]).toMatchObject({ doc: { title: "ABC" }, seq: 2 });
  });

  test("shows Updating… until the matching ready reply", async () => {
    const { posted, fromFrame, container } = mountPane({ title: "A" });
    fromFrame({ type: PREVIEW_LISTENING });
    expect(container.querySelector("[data-slot=preview-pending]")).not.toBeNull();
    fromFrame({ type: PREVIEW_READY, seq: 0 }); // stale reply
    expect(container.querySelector("[data-slot=preview-pending]")).not.toBeNull();
    fromFrame({ type: PREVIEW_READY, seq: posted.mock.calls[0]?.[0].seq });
    expect(container.querySelector("[data-slot=preview-pending]")).toBeNull();
  });

  test("includes the focus path in the message", () => {
    const { posted, fromFrame } = mountPane({ title: "A" }, ["blocks", 2]);
    fromFrame({ type: PREVIEW_LISTENING });
    expect(posted.mock.calls[0]?.[0]).toMatchObject({ focus: ["blocks", 2] });
  });

  test("ignores messages from another origin or another window", () => {
    const { posted, frameWindow } = mountPane({ title: "A" });
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: PREVIEW_LISTENING },
          origin: "https://evil.example",
          source: frameWindow,
        }),
      );
      window.dispatchEvent(
        new MessageEvent("message", { data: { type: PREVIEW_LISTENING }, origin, source: window }),
      );
    });
    expect(posted).not.toHaveBeenCalled();
  });

  test("the device toggle narrows the frame; reload remounts it", () => {
    const { container } = mountPane({ title: "A" });
    fireEvent.click(screen.getByRole("button", { name: "Mobile width" }));
    const narrow = container.querySelector("iframe") as HTMLIFrameElement;
    expect(narrow.style.width).toBe("390px");
    fireEvent.click(screen.getByRole("button", { name: "Reload preview" }));
    const reloaded = container.querySelector("iframe") as HTMLIFrameElement;
    expect(reloaded).not.toBe(narrow);
  });
});
