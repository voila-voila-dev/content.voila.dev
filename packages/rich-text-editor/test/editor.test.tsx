import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { RichTextEditor } from "../src/editor.tsx";

afterEach(cleanup);

// The editable surface must carry the host form's `id` + aria wiring so a
// `<label htmlFor>` names it and `aria-invalid` / `aria-describedby` convey
// validation state — the same contract the @voila/content-ui widgets honour.
describe("RichTextEditor aria forwarding", () => {
  test("forwards id and aria attributes onto the editable surface", () => {
    const { container } = render(
      <RichTextEditor
        value={[{ type: "p", children: [{ text: "hi" }] }]}
        id="body"
        aria-labelledby="body-label"
        aria-describedby="body-error"
        aria-invalid={true}
      />,
    );
    const editable = container.querySelector("#body");
    expect(editable).not.toBeNull();
    expect(editable?.getAttribute("aria-labelledby")).toBe("body-label");
    expect(editable?.getAttribute("aria-describedby")).toBe("body-error");
    expect(editable?.getAttribute("aria-invalid")).toBe("true");
  });

  test("omits aria attributes when not provided", () => {
    const { container } = render(
      <RichTextEditor value={[{ type: "p", children: [{ text: "hi" }] }]} />,
    );
    const editable = container.querySelector(".voila-rich-text");
    expect(editable).not.toBeNull();
    expect(editable?.getAttribute("aria-invalid")).toBeNull();
  });
});
