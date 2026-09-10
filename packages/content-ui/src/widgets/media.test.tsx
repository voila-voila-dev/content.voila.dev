import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fields } from "@voila/content";
import { defaultDisplayRegistry } from "../registry/registry";
import {
  createMediaInput,
  formatBytes,
  MediaDisplay,
  mediaFilename,
  readImageSize,
  tooLargeMessage,
  uploadErrorMessage,
} from "./media";

afterEach(cleanup);

const IMAGE = {
  id: "m1",
  url: "/admin/api/_media/m1/file",
  filename: "cat.png",
  mime: "image/png",
  size: 2048,
  width: 1200,
  height: 800,
  alt: "A cat",
};

const PDF = {
  id: "d1",
  url: "/admin/api/_media/d1/file",
  filename: "invoice.pdf",
  mime: "application/pdf",
  size: 1500,
};

function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

// The upload path awaits a dimension probe for images, which a headless DOM
// never resolves (it falls back after a timeout). Non-image files skip the probe
// entirely, so they keep the upload tests instant — the probe has its own test.
function textFile(name = "notes.txt"): File {
  return new File(["x"], name, { type: "text/plain" });
}

describe("formatBytes", () => {
  test("scales to the largest unit that keeps the number small", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.0 GB");
  });

  test("returns null for junk instead of rendering NaN into a caption", () => {
    expect(formatBytes(undefined)).toBeNull();
    expect(formatBytes(-1)).toBeNull();
    expect(formatBytes(Number.NaN)).toBeNull();
    expect(formatBytes("2048")).toBeNull();
  });
});

describe("uploadErrorMessage", () => {
  test("turns the REST 413 envelope into a sentence naming the limit", () => {
    // What `makeMediaClient` raises: a `ContentClientError` whose `message` is
    // the bare code. Nobody should read "TOO_LARGE (413)" in a form.
    const error = Object.assign(new Error("TOO_LARGE (413)"), {
      status: 413,
      failure: { code: "TOO_LARGE", maxBytes: 5 * 1024 * 1024, size: 9_000_000 },
    });
    expect(uploadErrorMessage(error)).toBe("This file is larger than the 5.0 MB limit.");
  });

  test("still avoids the raw code when the failure carries no cap", () => {
    const error = Object.assign(new Error("TOO_LARGE (413)"), {
      status: 413,
      failure: { code: "TOO_LARGE" },
    });
    expect(uploadErrorMessage(error)).toBe("This file is larger than the upload limit.");
  });

  test("passes through a real error message, and names the failure otherwise", () => {
    expect(uploadErrorMessage(new Error("Network down"))).toBe("Network down");
    expect(uploadErrorMessage("nope")).toBe("Upload failed.");
  });
});

describe("mediaFilename", () => {
  test("prefers the stored filename, then alt, then the mime", () => {
    expect(mediaFilename(IMAGE)).toBe("cat.png");
    expect(mediaFilename({ ...IMAGE, filename: "  " })).toBe("A cat");
    expect(mediaFilename({ ...IMAGE, filename: undefined, alt: undefined })).toBe("image/png");
  });
});

describe("MediaDisplay", () => {
  test("renders a 28px thumbnail named by its filename in a table cell", () => {
    // A media column used to be an em-dash on every row; the point of the cell
    // is recognizing the asset at a glance, and naming it for screen readers.
    const { container } = render(
      <MediaDisplay value={IMAGE} meta={fields.media().meta} context="cell" />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.className).toContain("size-7");
    expect(img.getAttribute("alt")).toBe("A cat");
    // No caption competes with the thumbnail in a dense row.
    expect(container.textContent).toBe("");
  });

  test("shows dimensions and size under the preview on the detail page", () => {
    const { container } = render(<MediaDisplay value={IMAGE} meta={fields.media().meta} />);
    expect(container.textContent).toContain("cat.png");
    expect(container.textContent).toContain("1200 × 800");
    expect(container.textContent).toContain("2.0 KB");
  });

  test("degrades a non-image to a named file glyph, never a broken <img>", () => {
    const { container } = render(<MediaDisplay value={PDF} meta={fields.media().meta} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "invoice.pdf" })).toBeDefined();
    expect(container.textContent).toContain("application/pdf");
  });

  test("links the preview through to the asset in a new tab", () => {
    const { container } = render(<MediaDisplay value={IMAGE} meta={fields.media().meta} />);
    const link = container.querySelector("a") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe(IMAGE.url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
    // The thumbnail lives inside the link, so the whole preview is clickable.
    expect(link.querySelector("img")).not.toBeNull();
  });

  test("empty reads as an invitation on detail and as the shared em-dash in a cell", () => {
    const { container: a } = render(<MediaDisplay value={null} meta={fields.media().meta} />);
    expect(a.textContent).toContain("No image yet");
    // The dashed placeholder box read as a broken image; a soft tile doesn't.
    expect(a.querySelector("[data-empty]")?.className).not.toContain("border-dashed");
    const { container: b } = render(
      <MediaDisplay value={{ size: 1 }} meta={fields.media().meta} context="cell" />,
    );
    expect(b.textContent).toBe("—");
  });

  test("is registered for the media kind by default", () => {
    expect(defaultDisplayRegistry.media).toBe(MediaDisplay);
  });
});

describe("readImageSize", () => {
  test("skips the probe entirely for a non-image", async () => {
    expect(await readImageSize(textFile())).toBeUndefined();
  });

  test("reports the decoded pixel size so the record can caption it", async () => {
    // Only the browser has the decoded image; the server stores what we send.
    const created: string[] = [];
    const realImage = globalThis.Image;
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => "blob:fake";
    URL.revokeObjectURL = (url: string) => created.push(url);
    globalThis.Image = class {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;
    try {
      expect(await readImageSize(new File(["x"], "a.png", { type: "image/png" }))).toEqual({
        width: 640,
        height: 480,
      });
      // The object URL is released, so a long editing session doesn't leak blobs.
      expect(created).toEqual(["blob:fake"]);
    } finally {
      globalThis.Image = realImage;
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
    }
  });

  test("gives up on an image that never decodes instead of wedging the upload", async () => {
    const realImage = globalThis.Image;
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = () => "blob:fake";
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        this.onerror?.();
      }
    } as unknown as typeof Image;
    try {
      expect(await readImageSize(new File(["x"], "a.png", { type: "image/png" }))).toBeUndefined();
    } finally {
      globalThis.Image = realImage;
      URL.createObjectURL = realCreate;
    }
  });
});

describe("createMediaInput", () => {
  test("uploads the picked file and emits the stored value", async () => {
    const onChange = mock();
    const upload = mock(async () => IMAGE);
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget value={undefined} onChange={onChange} field={fields.media()} id="cover" />,
    );
    // Empty state offers a dropzone that also explains paste and click.
    expect(screen.getByRole("button", { name: /click to upload/ })).toBeDefined();
    const file = textFile();
    fireEvent.change(fileInput(container), { target: { files: [file] } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(upload.mock.calls[0]?.[0]).toBe(file);
    expect(onChange).toHaveBeenCalledWith(IMAGE);
  });

  test("uploads a file dropped onto the dropzone", async () => {
    const upload = mock(async () => IMAGE);
    const Widget = createMediaInput({ upload });
    render(<Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" />);
    const zone = screen.getByRole("button", { name: /click to upload/ });
    fireEvent.dragOver(zone);
    expect(zone.getAttribute("data-dragging")).toBe("true");
    fireEvent.drop(zone, { dataTransfer: { files: [textFile("dropped.txt")] } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    // The drag highlight clears on drop, not only on dragleave.
    expect(zone.getAttribute("data-dragging")).toBeNull();
  });

  test("uploads an image pasted from the clipboard", async () => {
    // Pasting a screenshot is the shortest path from "I made this" to "it's in
    // the CMS"; without it the user has to save the file first.
    const upload = mock(async () => IMAGE);
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" />,
    );
    const root = container.querySelector('[data-slot="media-input"]') as HTMLElement;
    fireEvent.paste(root, { clipboardData: { files: [textFile("pasted.txt")] } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
  });

  test("ignores a paste that carries no file, so text paste stays normal", () => {
    const upload = mock(async () => IMAGE);
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" />,
    );
    const root = container.querySelector('[data-slot="media-input"]') as HTMLElement;
    fireEvent.paste(root, { clipboardData: { files: [] } });
    expect(upload).not.toHaveBeenCalled();
  });

  test("shows an indeterminate progress bar while the upload is in flight", async () => {
    let release: (value: typeof IMAGE) => void = () => {};
    const upload = mock(() => new Promise<typeof IMAGE>((resolve) => (release = resolve)));
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" />,
    );
    fireEvent.change(fileInput(container), { target: { files: [textFile()] } });
    const bar = await screen.findByRole("progressbar", { name: "Uploading" });
    // No value: `fetch` reports no upload progress, so a percentage would lie.
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    release(IMAGE);
    await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  });

  test("derives the accept attribute from the field's accept globs", () => {
    const Widget = createMediaInput({ upload: mock(async () => IMAGE) });
    const { container } = render(
      <Widget
        value={undefined}
        onChange={mock()}
        field={fields.media({ accept: ["image/png", "image/jpeg"] })}
        id="cover"
      />,
    );
    expect(fileInput(container).getAttribute("accept")).toBe("image/png,image/jpeg");
  });

  test("previews an existing value with its name, dimensions and size", () => {
    const Widget = createMediaInput({ upload: mock(async () => IMAGE) });
    const { container } = render(
      <Widget value={IMAGE} onChange={mock()} field={fields.media()} id="cover" />,
    );
    expect(container.textContent).toContain("cat.png");
    expect(container.textContent).toContain("1200 × 800");
    expect(container.textContent).toContain("2.0 KB");
  });

  test("shows a non-image as a named file chip rather than an <img>", () => {
    const Widget = createMediaInput({ upload: mock(async () => PDF) });
    const { container } = render(
      <Widget value={PDF} onChange={mock()} field={fields.media()} id="doc" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "invoice.pdf" })).toBeDefined();
    expect(container.textContent).toContain("1.5 KB");
  });

  test("edits the alt text of the set value", () => {
    const onChange = mock();
    const Widget = createMediaInput({ upload: mock(async () => IMAGE) });
    render(<Widget value={IMAGE} onChange={onChange} field={fields.media()} id="cover" />);
    const alt = screen.getByLabelText("Alt text") as HTMLInputElement;
    expect(alt.value).toBe("A cat");
    fireEvent.change(alt, { target: { value: "A black cat" } });
    expect(onChange).toHaveBeenCalledWith({ ...IMAGE, alt: "A black cat" });
  });

  test("removes the value", () => {
    const onChange = mock();
    const Widget = createMediaInput({ upload: mock(async () => IMAGE) });
    render(<Widget value={IMAGE} onChange={onChange} field={fields.media()} id="cover" />);
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test("rejects a file over the field's max with the same sentence as the server", async () => {
    const onChange = mock();
    const upload = mock(async () => IMAGE);
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget
        value={undefined}
        onChange={onChange}
        field={fields.media({ max: 5 * 1024 * 1024 })}
        id="cover"
      />,
    );
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.txt", { type: "text/plain" });
    fireEvent.change(fileInput(container), { target: { files: [big] } });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(tooLargeMessage(5 * 1024 * 1024)),
    );
    // The round-trip is skipped: the client already knows the answer.
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  test("surfaces a server 413 as the limit sentence, not a status code", async () => {
    const upload = mock(async () => {
      throw Object.assign(new Error("TOO_LARGE (413)"), {
        status: 413,
        failure: { code: "TOO_LARGE", maxBytes: 1024 },
      });
    });
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" />,
    );
    fireEvent.change(fileInput(container), { target: { files: [textFile()] } });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe(
        "This file is larger than the 1.0 KB limit.",
      ),
    );
  });

  test("surfaces an upload failure as an inline error", async () => {
    const onChange = mock();
    const upload = mock(async () => {
      throw new Error("Network down");
    });
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget value={undefined} onChange={onChange} field={fields.media()} id="cover" />,
    );
    fireEvent.change(fileInput(container), { target: { files: [textFile()] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Network down"));
    expect(onChange).not.toHaveBeenCalled();
  });

  test("a disabled field ignores a drop", () => {
    const upload = mock(async () => IMAGE);
    const Widget = createMediaInput({ upload });
    render(
      <Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" disabled />,
    );
    fireEvent.drop(screen.getByRole("button", { name: /click to upload/ }), {
      dataTransfer: { files: [textFile()] },
    });
    expect(upload).not.toHaveBeenCalled();
  });

  test("offers 'Choose existing' only when a library lister is wired", () => {
    const Widget = createMediaInput({ upload: mock(async () => IMAGE) });
    render(<Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" />);
    // Without `list` there is nothing to browse, so the button must not appear.
    expect(screen.queryByRole("button", { name: "Choose existing" })).toBeNull();
  });

  test("picks an already-uploaded asset from the library", async () => {
    const onChange = mock();
    const list = mock(async () => ({ data: [IMAGE, PDF], nextCursor: null }));
    const Widget = createMediaInput({ upload: mock(async () => IMAGE), list });
    render(<Widget value={undefined} onChange={onChange} field={fields.media()} id="cover" />);
    fireEvent.click(screen.getByRole("button", { name: /Choose existing/ }));
    // Nothing is fetched until the picker opens — a form full of media fields
    // shouldn't hit the library once per field on mount.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    const item = await screen.findByRole("button", { name: /cat\.png/ });
    fireEvent.click(item);
    expect(onChange).toHaveBeenCalledWith(IMAGE);
  });

  test("says so when the library can't be loaded", async () => {
    const list = mock(async () => {
      throw new Error("offline");
    });
    const Widget = createMediaInput({ upload: mock(async () => IMAGE), list });
    render(<Widget value={undefined} onChange={mock()} field={fields.media()} id="cover" />);
    fireEvent.click(screen.getByRole("button", { name: /Choose existing/ }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Couldn't load the media library"),
    );
  });
});
