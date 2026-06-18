// Image media: insert an image into the document by uploading the file through
// the host's `_media` pipeline. It mirrors `./mention` — the editor stays
// data-agnostic (it never imports a media client); the host supplies an
// `upload` function (typically `mediaClient.upload`) and this module owns the
// editor side: a placeholder while the bytes upload, then a read-only image.
//
// The inserted node matches the engine's `image()` element schema
// (`url` / `alt` / `caption` / `width` / `height`), so it round-trips through
// the wire adapter and validates on write. `image-placeholder` is the engine's
// upload-in-progress element; it renders a spinner and never survives a
// completed upload (replaced by the image, or removed on failure). Its
// transient `_uploadId` / `filename` props are dropped by the engine validator
// (the schema keeps only `id`/`type`/`children`), so a save mid-upload is safe.
//
// Only `image` is wired today; `video` / `file` / `embed` follow the same
// pattern (a void element + the host's upload) and are additive — the wire
// adapter preserves them opaquely until then.

import type { NodeComponent } from "platejs";
import type { AnyPlatePlugin, PlateEditor, PlateElementProps } from "platejs/react";
import { createPlatePlugin, PlateElement, useEditorReadOnly, useEditorRef } from "platejs/react";
import { type ChangeEvent, type ReactNode, useRef } from "react";

/** Plate node key for an inserted image (a block void). */
export const IMAGE_KEY = "image";
/** Plate node key for an upload-in-progress placeholder (a block void). */
export const IMAGE_PLACEHOLDER_KEY = "image_placeholder";

/** Transient prop tying a placeholder to its in-flight upload (never persisted). */
const UPLOAD_ID_KEY = "_uploadId";

/**
 * The slice of the media record the image element needs. `mediaClient.upload`
 * returns a superset of this, so `upload: (file) => mediaClient.upload(file)`
 * satisfies it directly.
 */
export interface UploadedMedia {
  readonly url: string;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface MediaOptions {
  /** Uploads a file and resolves to the stored media (its `url` at minimum). */
  readonly upload: (file: File) => Promise<UploadedMedia>;
  /** `accept` attribute for the file picker / a filter for drop & paste. Defaults to `"image/*"`. */
  readonly accept?: string;
  /**
   * Notified when an upload fails (the placeholder is removed regardless). When
   * omitted the failure is logged via `console.error` instead of vanishing
   * silently, so a host that forgets this hook still sees the error.
   */
  readonly onError?: (error: unknown, file: File) => void;
  /** Mints the transient upload id. Defaults to `crypto.randomUUID`; injected for tests. */
  readonly generateId?: () => string;
}

type AnyRecord = Record<string, unknown>;

function defaultGenerateId(): string {
  return crypto.randomUUID();
}

// A readable `alt` fallback from a filename — drop the directory and extension
// and turn separators into spaces. Far better for screen readers than the empty
// `alt` an upload with no caption would otherwise leave on the image.
function altFromFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

/** Reads only the image keys off an `UploadedMedia`, omitting absent optionals.
 *  `filename` seeds an `alt` fallback when the upload didn't supply one. */
function imageNode(media: UploadedMedia, filename?: string): AnyRecord {
  const node: AnyRecord = { type: IMAGE_KEY, url: media.url, children: [{ text: "" }] };
  const alt = media.alt ?? (filename ? altFromFilename(filename) : undefined);
  if (alt) node.alt = alt;
  if (typeof media.width === "number") node.width = media.width;
  if (typeof media.height === "number") node.height = media.height;
  return node;
}

/** Current path of the placeholder for `uploadId`, or `undefined` if it's gone. */
function findUploadPath(editor: PlateEditor, uploadId: string): number[] | undefined {
  for (const [, path] of editor.api.nodes({
    at: [],
    match: (node) => (node as AnyRecord)[UPLOAD_ID_KEY] === uploadId,
  })) {
    return path as number[];
  }
  return undefined;
}

/**
 * Uploads `files` and inserts an image for each, showing a placeholder while the
 * bytes travel. Non-image files are ignored. Each upload runs independently, so
 * one failing leaves the others (and the rest of the document) intact; the
 * placeholder is matched back by id at replace time, so it survives edits made
 * elsewhere during the upload.
 */
export async function insertImageFiles(
  editor: PlateEditor,
  files: ArrayLike<File>,
  options: MediaOptions,
): Promise<void> {
  const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
  await Promise.all(images.map((file) => uploadOne(editor, file, options)));
}

async function uploadOne(editor: PlateEditor, file: File, options: MediaOptions): Promise<void> {
  const uploadId = (options.generateId ?? defaultGenerateId)();
  editor.tf.insertNodes({
    type: IMAGE_PLACEHOLDER_KEY,
    [UPLOAD_ID_KEY]: uploadId,
    filename: file.name,
    children: [{ text: "" }],
  });
  try {
    const media = await options.upload(file);
    const path = findUploadPath(editor, uploadId);
    if (!path) return;
    editor.tf.withoutNormalizing(() => {
      editor.tf.removeNodes({ at: path });
      editor.tf.insertNodes(imageNode(media, file.name) as never, { at: path });
    });
  } catch (error) {
    const path = findUploadPath(editor, uploadId);
    if (path) editor.tf.removeNodes({ at: path });
    // Never fail silently: a host without an `onError` still gets the error on
    // the console rather than just watching the placeholder disappear.
    if (options.onError) options.onError(error, file);
    else console.error(`[@voila/rich-text-editor] image upload failed for "${file.name}":`, error);
  }
}

/** Read-only render of an inserted image (with an optional caption). */
function ImageElement(props: PlateElementProps): ReactNode {
  const { element } = props;
  const url = element.url as string | undefined;
  const alt = (element.alt as string | undefined) ?? "";
  const caption = element.caption as string | undefined;
  return (
    <PlateElement {...props} className="voila-rich-text-image">
      <figure contentEditable={false}>
        {url ? <img src={url} alt={alt} /> : null}
        {caption ? <figcaption>{caption}</figcaption> : null}
      </figure>
      {props.children}
    </PlateElement>
  );
}

/** The uploading-in-progress placeholder: a spinner and the file name. */
function ImagePlaceholderElement(props: PlateElementProps): ReactNode {
  const filename = props.element.filename as string | undefined;
  return (
    <PlateElement {...props} className="voila-rich-text-image-placeholder">
      <span contentEditable={false} className="voila-rich-text-image-placeholder-body">
        <span className="voila-rich-text-spinner" aria-hidden="true" />
        Uploading{filename ? ` ${filename}` : ""}…
      </span>
      {props.children}
    </PlateElement>
  );
}

/** The bare image render plugin — a block void. */
const ImagePlugin = createPlatePlugin({
  key: IMAGE_KEY,
  node: { isElement: true, isVoid: true, component: ImageElement },
});

/** The placeholder render plugin — a block void. */
const ImagePlaceholderPlugin = createPlatePlugin({
  key: IMAGE_PLACEHOLDER_KEY,
  node: { isElement: true, isVoid: true, component: ImagePlaceholderElement },
});

/** Drop & paste handlers that upload any image files the event carries. */
function mediaHandlers(options: MediaOptions) {
  function handleFiles(editor: PlateEditor, files: FileList | null | undefined): boolean {
    if (!files || files.length === 0) return false;
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) return false;
    void insertImageFiles(editor, images, options);
    return true;
  }
  return {
    onDrop: ({ editor, event }: { editor: PlateEditor; event: React.DragEvent }) => {
      if (!handleFiles(editor, event.dataTransfer?.files)) return false;
      event.preventDefault();
      return true;
    },
    onPaste: ({ editor, event }: { editor: PlateEditor; event: React.ClipboardEvent }) => {
      if (!handleFiles(editor, event.clipboardData?.files)) return false;
      event.preventDefault();
      return true;
    },
  };
}

export interface MediaPluginConfig {
  readonly plugins: ReadonlyArray<AnyPlatePlugin>;
  readonly components: Record<string, NodeComponent>;
}

/**
 * The plugins + component map that render images, and — when `options` are
 * supplied — the upload placeholder plus drop/paste handlers. Pass `{ media }`
 * to `derivePlugins` to wire this; without `options` it renders existing images
 * read-only but offers no way to add new ones (the insert UI needs the host's
 * `upload`).
 */
export function mediaPlugins(options?: MediaOptions): MediaPluginConfig {
  const components: Record<string, NodeComponent> = { [IMAGE_KEY]: ImageElement };
  if (!options) {
    return { plugins: [ImagePlugin as unknown as AnyPlatePlugin], components };
  }
  components[IMAGE_PLACEHOLDER_KEY] = ImagePlaceholderElement;
  const image = ImagePlugin.extend({ handlers: mediaHandlers(options) });
  return {
    plugins: [
      image as unknown as AnyPlatePlugin,
      ImagePlaceholderPlugin as unknown as AnyPlatePlugin,
    ],
    components,
  };
}

export interface RichTextImageButtonProps {
  /** Uploads the chosen file; resolves to the stored media (its `url` at least). */
  readonly upload: MediaOptions["upload"];
  /** `accept` attribute for the file picker. Defaults to `"image/*"`. */
  readonly accept?: string;
  /** Accessible label / tooltip. Defaults to `"Insert image"`. */
  readonly label?: string;
  readonly onError?: MediaOptions["onError"];
  readonly className?: string;
}

/**
 * A toolbar control that picks an image file and inserts it. Render it in the
 * editor's `toolbar` slot (via `RichTextToolbar`'s `extra` prop) so it sits
 * inside the Plate provider and can drive the editor.
 */
export function RichTextImageButton({
  upload,
  accept = "image/*",
  label = "Insert image",
  onError,
  className = "voila-rich-text-toolbar-button",
}: RichTextImageButtonProps): ReactNode {
  const editor = useEditorRef();
  const readOnly = useEditorReadOnly();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.target;
    if (files && files.length > 0) void insertImageFiles(editor, files, { upload, onError });
    event.target.value = "";
  }

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        title={label}
        disabled={readOnly}
        // Keep the editor selection on press so the image inserts where the
        // caret was (a plain click would blur it first).
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={onPick}
      />
    </>
  );
}
