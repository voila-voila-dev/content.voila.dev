import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { Descendant } from "platejs";
import { createPlateEditor, Plate, PlateContent } from "platejs/react";
import { derivePlugins, deriveToolbar } from "../src/content/capabilities.ts";
import { insertImageFiles, type MediaOptions, RichTextImageButton } from "../src/media.tsx";
import { RichTextToolbar } from "../src/toolbar.tsx";

afterEach(cleanup);

/** A one-paragraph editor that allows `image`, with the media plugins wired. */
function editorWithImage(media: MediaOptions) {
  const { plugins, components } = derivePlugins(["paragraph", "image"], [], { media });
  return createPlateEditor({
    plugins,
    components,
    value: [{ id: "p", type: "p", children: [{ text: "hi" }] }],
    selection: {
      anchor: { path: [0, 0], offset: 2 },
      focus: { path: [0, 0], offset: 2 },
    },
  });
}

function pngFile(name = "photo.png"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

function typeOf(node: Descendant): string | undefined {
  return (node as { type?: string }).type;
}

describe("insertImageFiles", () => {
  test("inserts a placeholder while uploading, then replaces it with the image", async () => {
    let resolveUpload!: (m: { url: string }) => void;
    const media: MediaOptions = {
      upload: () => new Promise((resolve) => (resolveUpload = resolve)),
      generateId: () => "u1",
    };
    const editor = editorWithImage(media);

    const promise = insertImageFiles(editor, [pngFile()], media);

    // Mid-flight: a placeholder labelled with the file name sits in the doc.
    const placeholder = editor.children.find((n) => typeOf(n) === "image_placeholder");
    expect(placeholder).toBeDefined();
    expect((placeholder as { filename?: string }).filename).toBe("photo.png");
    expect(editor.children.some((n) => typeOf(n) === "image")).toBe(false);

    resolveUpload({ url: "https://cdn/p.png" });
    await promise;

    // The placeholder is gone and a real image carries the uploaded url.
    expect(editor.children.some((n) => typeOf(n) === "image_placeholder")).toBe(false);
    const image = editor.children.find((n) => typeOf(n) === "image") as { url?: string };
    expect(image?.url).toBe("https://cdn/p.png");
  });

  test("carries alt + dimensions from the upload result onto the image", async () => {
    const media: MediaOptions = {
      upload: async () => ({ url: "https://cdn/d.png", alt: "Diagram", width: 640, height: 480 }),
      generateId: () => "u1",
    };
    const editor = editorWithImage(media);
    await insertImageFiles(editor, [pngFile()], media);
    const image = editor.children.find((n) => typeOf(n) === "image") as {
      url?: string;
      alt?: string;
      width?: number;
      height?: number;
    };
    expect(image).toMatchObject({
      url: "https://cdn/d.png",
      alt: "Diagram",
      width: 640,
      height: 480,
    });
  });

  test("removes the placeholder and reports onError when the upload fails", async () => {
    const failure = new Error("upload failed");
    const errors: unknown[] = [];
    const media: MediaOptions = {
      upload: () => Promise.reject(failure),
      onError: (error) => errors.push(error),
      generateId: () => "u1",
    };
    const editor = editorWithImage(media);

    await insertImageFiles(editor, [pngFile()], media);

    expect(editor.children.some((n) => typeOf(n) === "image_placeholder")).toBe(false);
    expect(editor.children.some((n) => typeOf(n) === "image")).toBe(false);
    expect(errors).toEqual([failure]);
  });

  test("ignores non-image files (the upload is never called)", async () => {
    let calls = 0;
    const media: MediaOptions = {
      upload: async () => {
        calls += 1;
        return { url: "x" };
      },
    };
    const editor = editorWithImage(media);
    await insertImageFiles(editor, [new File(["x"], "a.txt", { type: "text/plain" })], media);
    expect(calls).toBe(0);
    expect(
      editor.children.some((n) => typeOf(n) === "image" || typeOf(n) === "image_placeholder"),
    ).toBe(false);
  });
});

describe("RichTextImageButton", () => {
  test("picks a file and inserts the uploaded image", async () => {
    const media: MediaOptions = { upload: async () => ({ url: "https://cdn/b.png" }) };
    const editor = editorWithImage(media);
    const { container, getByLabelText } = render(
      <Plate editor={editor}>
        <RichTextImageButton upload={media.upload} />
        <PlateContent />
      </Plate>,
    );

    expect(getByLabelText("Insert image").tagName).toBe("BUTTON");
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [pngFile("b.png")] } });
    });

    await waitFor(() => expect(editor.children.some((n) => typeOf(n) === "image")).toBe(true));
  });

  test("is disabled while the editor is read-only", () => {
    const media: MediaOptions = { upload: async () => ({ url: "x" }) };
    const editor = editorWithImage(media);
    const { getByLabelText } = render(
      <Plate editor={editor} readOnly>
        <RichTextImageButton upload={media.upload} />
      </Plate>,
    );
    expect((getByLabelText("Insert image") as HTMLButtonElement).disabled).toBe(true);
  });

  test("renders inside the toolbar landmark via the `extra` slot", () => {
    const media: MediaOptions = { upload: async () => ({ url: "x" }) };
    const editor = editorWithImage(media);
    const { getByRole } = render(
      <Plate editor={editor}>
        <RichTextToolbar
          model={deriveToolbar(["paragraph", "heading-1"], ["bold"])}
          extra={<RichTextImageButton upload={media.upload} />}
        />
      </Plate>,
    );
    const toolbar = getByRole("toolbar");
    expect(toolbar.querySelector('[aria-label="Insert image"]')).not.toBeNull();
  });
});

describe("drop & paste", () => {
  function mountEditable(media: MediaOptions) {
    const editor = editorWithImage(media);
    const { container } = render(
      <Plate editor={editor}>
        <PlateContent />
      </Plate>,
    );
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    return { editor, editable };
  }

  // We short-circuit the editor's default drop/paste (which can't resolve a DOM
  // range under happy-dom) by handling image files ourselves — that's the path
  // asserted here. A non-image drop falls through to that default, so it isn't
  // exercised in this environment.
  test("dropping image files uploads and inserts them", async () => {
    const media: MediaOptions = { upload: async () => ({ url: "https://cdn/drop.png" }) };
    const { editor, editable } = mountEditable(media);
    await act(async () => {
      fireEvent.drop(editable, {
        dataTransfer: { files: [pngFile("drop.png")], types: ["Files"] },
      });
    });
    await waitFor(() => expect(editor.children.some((n) => typeOf(n) === "image")).toBe(true));
  });
});
