import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fields } from "@voila/content";
import { defaultDisplayRegistry } from "../registry/registry";
import { createMediaInput, MediaDisplay } from "./media";

afterEach(cleanup);

const IMAGE = {
  id: "m1",
  url: "/admin/api/_media/m1/file",
  mime: "image/png",
  size: 2048,
  alt: "A cat",
};

const PDF = { id: "d1", url: "/admin/api/_media/d1/file", mime: "application/pdf", size: 1500 };

function fileInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

describe("MediaDisplay", () => {
  test("renders an image thumbnail with the stored alt and a size caption", () => {
    const { container } = render(<MediaDisplay value={IMAGE} meta={fields.media().meta} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(IMAGE.url);
    expect(img.getAttribute("alt")).toBe("A cat");
    expect(container.textContent).toContain("2.0 KB");
  });

  test("labels a non-image by its mime instead of rendering an <img>", () => {
    const { container } = render(<MediaDisplay value={PDF} meta={fields.media().meta} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("application/pdf");
  });

  test("shows the empty marker for a missing or malformed value", () => {
    const { container: a } = render(<MediaDisplay value={null} meta={fields.media().meta} />);
    expect(a.textContent).toBe("—");
    const { container: b } = render(
      <MediaDisplay value={{ size: 1 }} meta={fields.media().meta} />,
    );
    expect(b.textContent).toBe("—");
  });

  test("is registered for the media kind by default", () => {
    expect(defaultDisplayRegistry.media).toBe(MediaDisplay);
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
    // Empty state offers an Upload button and an empty file control.
    expect(screen.getByRole("button", { name: "Upload" })).toBeDefined();
    const file = new File(["x"], "cat.png", { type: "image/png" });
    fireEvent.change(fileInput(container), { target: { files: [file] } });
    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
    expect(upload.mock.calls[0]?.[0]).toBe(file);
    expect(onChange).toHaveBeenCalledWith(IMAGE);
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

  test("previews an existing value and edits its alt text", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  test("rejects a file over the field's max without uploading", async () => {
    const onChange = mock();
    const upload = mock(async () => IMAGE);
    const Widget = createMediaInput({ upload });
    const { container } = render(
      <Widget value={undefined} onChange={onChange} field={fields.media({ max: 4 })} id="cover" />,
    );
    const big = new File(["too many bytes"], "big.png", { type: "image/png" });
    fireEvent.change(fileInput(container), { target: { files: [big] } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("too large"));
    expect(upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
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
    fireEvent.change(fileInput(container), {
      target: { files: [new File(["x"], "cat.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Network down"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
