import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { fields, rt } from "@voila/content";
import { RichTextInput } from "./rich-text";

afterEach(cleanup);

const field = fields.richText();

/** The field is a Standard Schema; reach its validator for the round-trip check. */
function validate(value: unknown): { issues?: ReadonlyArray<unknown> } {
  return (
    field as unknown as {
      "~standard": { validate(v: unknown): { issues?: ReadonlyArray<unknown> } };
    }
  )["~standard"].validate(value);
}
const doc = [{ id: "p1", type: "paragraph", children: [{ text: "hello" }] }];

describe("RichTextInput", () => {
  test("renders the document in an editable carrying the field id", () => {
    const { container } = render(
      <RichTextInput value={doc} onChange={mock()} field={field} id="posts-body" />,
    );
    expect(container.querySelector("#posts-body")?.textContent).toContain("hello");
  });

  test("wires the aria contract from labelId + error, like the native widgets", () => {
    const { container } = render(
      <RichTextInput
        value={doc}
        onChange={mock()}
        field={field}
        id="b"
        labelId="b-label"
        error="Required."
      />,
    );
    const editable = container.querySelector("#b");
    expect(editable?.getAttribute("aria-labelledby")).toBe("b-label");
    expect(editable?.getAttribute("aria-invalid")).toBe("true");
    expect(editable?.getAttribute("aria-describedby")).toBe("b-error");
  });

  test("starts empty for a non-array value without crashing", () => {
    const { container } = render(
      <RichTextInput value={undefined} onChange={mock()} field={field} id="e" />,
    );
    expect(container.querySelector("#e")).not.toBeNull();
  });

  test("renders read-only when disabled", () => {
    const { container } = render(
      <RichTextInput value={doc} onChange={mock()} field={field} id="d" disabled />,
    );
    expect(container.querySelector("#d")?.getAttribute("contenteditable")).toBe("false");
  });

  test("derives a restricted editor from the field's allowed elements/marks", () => {
    const restricted = fields.richText({ elements: [rt.paragraph, rt.link], marks: [rt.bold] });
    const { container } = render(
      <RichTextInput value={doc} onChange={mock()} field={restricted} id="r" />,
    );
    expect(container.querySelector("#r")?.textContent).toContain("hello");
  });

  test("renders a formatting toolbar gated to the field's allowed controls", () => {
    const restricted = fields.richText({ elements: [rt.paragraph], marks: [rt.bold] });
    const { getByRole, queryByLabelText } = render(
      <RichTextInput value={doc} onChange={mock()} field={restricted} id="tb" />,
    );
    expect(getByRole("toolbar")).not.toBeNull();
    expect(queryByLabelText("Bold")).not.toBeNull();
    expect(queryByLabelText("Heading 1")).toBeNull();
  });

  test("emits a schema-valid, id-complete wire document when the editor normalizes", async () => {
    const onChange = mock();
    render(
      // A paragraph with no id: the node-id plugin mints one on mount and the
      // editor's change fires, so toWire's output must be a valid wire document.
      <RichTextInput
        value={[{ type: "paragraph", children: [{ text: "hi" }] }]}
        onChange={onChange}
        field={field}
        id="n"
      />,
    );
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emitted = onChange.mock.calls.at(-1)?.[0] as ReadonlyArray<{ id: string; type: string }>;
    expect(emitted[0]?.id).toBeTruthy();
    expect(emitted[0]?.type).toBe("paragraph");
    expect(validate(emitted).issues).toBeUndefined();
  });
});

describe("RichTextInput — markdown fields", () => {
  const md = fields.markdown();

  test("edits a markdown string in a rich editor that carries the field id", () => {
    const { container } = render(
      <RichTextInput value="# Title" onChange={mock()} field={md} id="posts-body" />,
    );
    expect(container.querySelector("#posts-body")?.textContent).toContain("Title");
  });

  test("the markdown rich editor offers a formatting toolbar", () => {
    const { getByRole, queryByLabelText } = render(
      <RichTextInput value="hello" onChange={mock()} field={md} id="mtb" />,
    );
    expect(getByRole("toolbar")).not.toBeNull();
    expect(queryByLabelText("Bold")).not.toBeNull();
    // gfm (the default) has no underline spelling, so it never offers it.
    expect(queryByLabelText("Underline")).toBeNull();
  });

  test("serializes the editor back to a markdown string on change", async () => {
    const onChange = mock();
    render(<RichTextInput value="**hi**" onChange={onChange} field={md} id="m" />);
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const emitted = onChange.mock.calls.at(-1)?.[0];
    expect(typeof emitted).toBe("string");
    expect(emitted).toBe("**hi**\n");
  });

  test("toggles between the rich editor and the raw source", () => {
    const { container, getByText } = render(
      <RichTextInput value="hello" onChange={mock()} field={md} id="t" />,
    );
    // Starts rich (a contenteditable, no textarea).
    expect(container.querySelector("textarea")).toBeNull();
    fireEvent.click(getByText("Edit Markdown"));
    // Raw mode shows a textarea seeded with the markdown source.
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect((textarea as HTMLTextAreaElement).value).toContain("hello");
    fireEvent.click(getByText("Rich editor"));
    expect(container.querySelector("textarea")).toBeNull();
  });

  test("editing the raw textarea emits the string verbatim", () => {
    const onChange = mock();
    const { container, getByText } = render(
      <RichTextInput value="hi" onChange={onChange} field={md} id="r" />,
    );
    fireEvent.click(getByText("Edit Markdown"));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "## changed" } });
    expect(onChange).toHaveBeenLastCalledWith("## changed");
  });

  test("mdx stays a raw textarea with no rich toggle (cannot round-trip)", () => {
    const mdx = fields.markdown({ flavor: "mdx" });
    const { container, queryByText } = render(
      <RichTextInput value="<Foo />" onChange={mock()} field={mdx} id="x" />,
    );
    expect((container.querySelector("#x") as HTMLTextAreaElement)?.tagName).toBe("TEXTAREA");
    expect(queryByText("Edit Markdown")).toBeNull();
    expect(queryByText("Rich editor")).toBeNull();
  });

  test("renders the editor read-only when disabled", () => {
    const { container } = render(
      <RichTextInput value="# x" onChange={mock()} field={md} id="d" disabled />,
    );
    expect(container.querySelector("#d")?.getAttribute("contenteditable")).toBe("false");
  });
});
