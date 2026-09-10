// Media widgets — the read display and the upload-backed edit input for a
// `media` field (`fields.media()`, value shape `MediaValue`). The display is
// pure and ships in the default registry. The edit widget needs a way to put
// bytes somewhere, which `@voila/content-ui` deliberately doesn't know about
// (it stays client-free), so it's a *factory*: the host passes an `upload`
// function (e.g. wrapping `makeMediaClient(...).upload`) and gets back an
// `EditWidget` to drop into `mergeEditRegistry({ media: … })`. Pass `list` too
// and the widget gains a "Choose existing" picker over the media library —
// same seam, same reason (the admin layer is the one that fetches).
//
// The widget owns the whole set-a-file flow: drop, paste, browse, a picker over
// what's already uploaded, progress, a human-readable rejection, and the
// preview with filename / dimensions / size. On success it emits the stored
// `MediaValue` so the form re-validates it against the field's schema.

import {
  FileIcon,
  ImageIcon,
  ImagesSquareIcon,
  UploadSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { MediaValue } from "@voila/content";
import { Button } from "@voila.dev/ui/button";
import { Dialog } from "@voila.dev/ui/dialog";
import { Input } from "@voila.dev/ui/input";
import { cn } from "@voila.dev/ui/utils";
import {
  type ClipboardEvent,
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DisplayWidgetProps } from "./display";
import { Empty, isCompact } from "./display";
import type { EditWidget, EditWidgetProps } from "./edit";

/** The `media` field's `meta` carries the uploader's accept globs and size cap. */
interface MediaMetaShape {
  readonly accept?: ReadonlyArray<string>;
  readonly max?: number;
}

/** The upload response is a superset of `MediaValue` — it also names the file. */
type StoredMedia = MediaValue & { readonly filename?: string };

/** Narrow an unknown value to a stored `MediaValue` (has at least a `url`). */
function asMedia(value: unknown): StoredMedia | null {
  if (value === null || typeof value !== "object") return null;
  const v = value as { url?: unknown };
  return typeof v.url === "string" ? (value as StoredMedia) : null;
}

function isImage(media: MediaValue): boolean {
  return typeof media.mime === "string" && media.mime.startsWith("image/");
}

/**
 * The name to show and to announce. The wire record carries `filename`; a value
 * stored before that existed (or a hand-written one) falls back to its alt text,
 * then to the mime — never to an empty accessible name on a table thumbnail.
 */
export function mediaFilename(media: StoredMedia): string {
  const name = typeof media.filename === "string" ? media.filename.trim() : "";
  if (name !== "") return name;
  const alt = typeof media.alt === "string" ? media.alt.trim() : "";
  return alt !== "" ? alt : media.mime || "File";
}

/** Compact human size (`1.2 MB`) for the file caption — never throws on junk. */
export function formatBytes(bytes: unknown): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return null;
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${u === 0 ? n : n.toFixed(1)} ${units[u]}`;
}

/** `1200 × 800` when both dimensions are known, else `null`. */
function formatDimensions(media: MediaValue): string | null {
  const { width, height } = media;
  return typeof width === "number" && typeof height === "number" ? `${width} × ${height}` : null;
}

/** The one sentence a rejected-for-size upload gets, on either side of the wire. */
export function tooLargeMessage(maxBytes: number): string {
  return `This file is larger than the ${formatBytes(maxBytes) ?? `${maxBytes} B`} limit.`;
}

/**
 * The size cap a thrown upload failure names, if it is one. The REST layer
 * answers an oversized upload with a 413 `TOO_LARGE` envelope carrying
 * `maxBytes`; the client raises that as a `ContentClientError` whose `message`
 * is the bare code. Duck-typed on purpose — reading `failure.code` here would
 * make this presentational package depend on `@voila/content/client`.
 */
export function tooLargeLimit(cause: unknown): number | null {
  if (cause === null || typeof cause !== "object") return null;
  const failure = (cause as { failure?: { code?: unknown; maxBytes?: unknown } }).failure;
  if (failure?.code !== "TOO_LARGE") return null;
  return typeof failure.maxBytes === "number" ? failure.maxBytes : null;
}

/** Turn a thrown upload failure into something a person can act on. */
export function uploadErrorMessage(cause: unknown): string {
  const limit = tooLargeLimit(cause);
  if (limit !== null) return tooLargeMessage(limit);
  // A `TOO_LARGE` without a cap still shouldn't read as "TOO_LARGE (413)".
  if (tooLargeIsh(cause)) return "This file is larger than the upload limit.";
  return cause instanceof Error && cause.message !== "" ? cause.message : "Upload failed.";
}

function tooLargeIsh(cause: unknown): boolean {
  if (cause === null || typeof cause !== "object") return false;
  const err = cause as { status?: unknown; failure?: { code?: unknown } };
  return err.status === 413 || err.failure?.code === "TOO_LARGE";
}

/** How long the dimension probe may hold up an upload before giving up. */
const IMAGE_PROBE_TIMEOUT_MS = 1000;

/**
 * Pixel dimensions read in the browser, so the stored record knows them without
 * the server decoding the image. Resolves `undefined` for anything that isn't a
 * decodable image, and under SSR/tests where `Image`/`createObjectURL` are
 * absent. Dimensions are a nice-to-have caption, never a reason an upload can't
 * happen — hence the timeout: an environment whose `Image` fires neither `load`
 * nor `error` (a headless DOM, a stripped-down webview) must not wedge the form.
 */
export function readImageSize(file: File): Promise<{ width: number; height: number } | undefined> {
  if (
    !file.type.startsWith("image/") ||
    typeof Image === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;
    const done = (size: { width: number; height: number } | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(size);
    };
    const timer = setTimeout(() => done(undefined), IMAGE_PROBE_TIMEOUT_MS);
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => done(undefined);
    img.src = url;
  });
}

/** The first file on a drag or paste event, or `null`. */
function firstFile(list: FileList | null | undefined): File | null {
  return list && list.length > 0 ? (list[0] ?? null) : null;
}

// ---------- display ----------

/** The image (or a file glyph) at whatever size the surface asks for. */
function Thumb({
  media,
  className,
}: {
  readonly media: StoredMedia;
  readonly className: string;
}): ReactNode {
  const name = mediaFilename(media);
  if (isImage(media)) {
    // The filename is the accessible name: alt text describes the picture, but a
    // table row needs to know *which asset* the cell holds.
    return <img src={media.url} alt={media.alt || name} className={className} />;
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(className, "flex items-center justify-center bg-muted text-muted-foreground")}
    >
      <FileIcon aria-hidden />
    </span>
  );
}

/**
 * Read-only render of a media value. In a cell: a 28px rounded thumbnail named
 * by its filename — a column of em-dashes told the reader nothing. On the detail
 * page: the preview at a readable size with the filename, pixel dimensions and
 * size underneath. Both link through to the asset (new tab), so the value is
 * more than a dead preview. Registered for the `media` kind by default.
 */
export function MediaDisplay({ value, context }: DisplayWidgetProps): ReactNode {
  const media = asMedia(value);
  const compact = isCompact(context);
  if (media === null) {
    // A cell keeps the shared em-dash so the column stays scannable; the detail
    // page gets an empty state that reads as "nothing here yet" rather than a
    // dashed hole where a picture should be.
    if (compact) return <Empty />;
    return (
      <span
        data-slot="media-display"
        data-empty
        className="inline-flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-muted-foreground text-sm"
      >
        <ImageIcon className="size-4" aria-hidden />
        No image yet
      </span>
    );
  }
  const name = mediaFilename(media);
  const size = formatBytes(media.size);
  const dimensions = formatDimensions(media);
  return (
    <span
      data-slot="media-display"
      className={cn(
        "max-w-full align-middle",
        compact ? "inline-flex items-center" : "inline-flex items-start gap-3",
      )}
    >
      <a
        href={media.url}
        target="_blank"
        rel="noreferrer"
        title={name}
        className="inline-flex shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Thumb
          media={media}
          className={cn("shrink-0 rounded-md border object-cover", compact ? "size-7" : "size-24")}
        />
      </a>
      {compact ? null : (
        <span className="grid min-w-0 gap-0.5 text-xs leading-tight">
          <span className="truncate font-medium text-sm">{name}</span>
          {dimensions ? <span className="text-muted-foreground">{dimensions}</span> : null}
          <span className="text-muted-foreground">
            {[media.mime || "file", size].filter(Boolean).join(" · ")}
          </span>
        </span>
      )}
    </span>
  );
}

// ---------- edit ----------

/** Uploads a file and resolves to the stored `MediaValue` (what a media field
 *  holds). Wrap your media client, e.g. `(file, opts) => mediaClient.upload(file, opts)`. */
export type MediaUploader = (
  file: File,
  opts?: { alt?: string; width?: number; height?: number },
) => Promise<MediaValue>;

/** One page of the media library, newest first — `makeMediaClient(...).list`. */
export type MediaLister = (params?: { cursor?: string; limit?: number }) => Promise<{
  readonly data: ReadonlyArray<MediaValue>;
  readonly nextCursor: string | null;
}>;

export interface CreateMediaInputOptions {
  readonly upload: MediaUploader;
  /** Wire the library list and the widget offers "Choose existing". Omit it and
   *  the button never renders — there is nothing to browse. */
  readonly list?: MediaLister;
}

/**
 * Build a `media` edit widget bound to an `upload` function (and optionally the
 * library `list`). Register it on a form's edit registry:
 * `mergeEditRegistry({ media: createMediaInput({ upload, list }) })`.
 */
export function createMediaInput(options: CreateMediaInputOptions): EditWidget {
  const { upload, list } = options;

  function MediaInput({ value, onChange, field, id, error, disabled }: EditWidgetProps): ReactNode {
    const media = asMedia(value);
    const meta = field.meta as MediaMetaShape;
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    const accept =
      meta.accept !== undefined && meta.accept.length > 0 ? meta.accept.join(",") : undefined;
    // The upload failure is the widget's own; the field error (`${id}-error`) is
    // rendered by `CollectionForm`. Point the control at whichever is active,
    // and never reuse the form's id for ours (would collide when both are set).
    const describedBy = uploadError ? `${id}-upload-error` : error ? `${id}-error` : undefined;

    async function onFile(file: File): Promise<void> {
      setUploadError(null);
      // Enforce the field's byte cap before spending an upload round-trip; the
      // server enforces it too (413 TOO_LARGE), this is just a faster, clearer no.
      if (typeof meta.max === "number" && file.size > meta.max) {
        setUploadError(tooLargeMessage(meta.max));
        return;
      }
      setBusy(true);
      try {
        // Dimensions are read here because only the browser has the decoded
        // image; the caption can then show them without a server-side decode.
        const size = await readImageSize(file);
        const stored = await upload(file, size);
        onChange(stored);
      } catch (cause) {
        setUploadError(uploadErrorMessage(cause));
      } finally {
        setBusy(false);
      }
    }

    function onDrop(event: DragEvent<HTMLElement>): void {
      event.preventDefault();
      setDragging(false);
      if (disabled || busy) return;
      const file = firstFile(event.dataTransfer?.files);
      if (file) void onFile(file);
    }

    // Paste is the fastest path for a screenshot: copy, focus the field, ⌘V.
    function onPaste(event: ClipboardEvent<HTMLElement>): void {
      if (disabled || busy) return;
      const file = firstFile(event.clipboardData?.files);
      if (!file) return;
      event.preventDefault();
      void onFile(file);
    }

    function pickExisting(item: MediaValue): void {
      setUploadError(null);
      setPickerOpen(false);
      onChange(item);
    }

    const browse = () => inputRef.current?.click();

    return (
      // Paste is wired on the wrapper (not on one control) so it works wherever
      // focus lands inside the field; it's a convenience on top of the real
      // controls below, never the only way in.
      <div data-slot="media-input" className="space-y-2" onPaste={onPaste}>
        {media !== null ? (
          <div className="flex items-start gap-3">
            <Thumb media={media} className="size-20 shrink-0 rounded-md border object-cover" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="truncate font-medium text-sm" data-slot="media-filename">
                {mediaFilename(media)}
              </p>
              <p className="text-muted-foreground text-xs">
                {[formatDimensions(media), formatBytes(media.size), media.mime]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <Input
                aria-label="Alt text"
                placeholder="Describe this media (alt text)"
                value={media.alt ?? ""}
                disabled={disabled || busy}
                onChange={(e) => onChange({ ...media, alt: e.target.value })}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || busy}
                  onClick={browse}
                >
                  {busy ? "Uploading…" : "Replace"}
                </Button>
                {list ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || busy}
                    onClick={() => setPickerOpen(true)}
                  >
                    Choose existing
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || busy}
                  onClick={() => {
                    setUploadError(null);
                    onChange(undefined);
                  }}
                >
                  <XIcon aria-hidden />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* The dropzone: click, drop, or paste. A `<button>` so it's a real
                control for keyboard/AT; the drag handlers give pointer users the
                drop affordance. */}
            <button
              type="button"
              data-slot="media-dropzone"
              data-dragging={dragging || undefined}
              disabled={disabled || busy}
              onClick={browse}
              onDragOver={(event) => {
                event.preventDefault();
                if (!dragging) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-muted-foreground text-sm transition-colors",
                "hover:border-ring hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                dragging && "border-ring bg-muted/60",
                (disabled || busy) && "cursor-not-allowed opacity-60",
              )}
            >
              <UploadSimpleIcon className="size-5" aria-hidden />
              <span>{busy ? "Uploading…" : "Drop a file here, paste it, or click to upload"}</span>
              {accept ? <span className="text-xs">{accept}</span> : null}
            </button>
            {list ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || busy}
                onClick={() => setPickerOpen(true)}
              >
                <ImagesSquareIcon aria-hidden />
                Choose existing
              </Button>
            ) : null}
          </div>
        )}

        {busy ? (
          // Indeterminate on purpose: the media client uploads with `fetch`,
          // which reports no progress events, so a percentage would be a lie.
          <div
            data-slot="media-progress"
            role="progressbar"
            aria-label="Uploading"
            className="h-1 w-full overflow-hidden rounded-full bg-muted"
          >
            <span className="block h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        ) : null}

        {/* The real control the label points at; visually hidden, opened by the
            buttons above. Carries the field error wiring for assistive tech. */}
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled || busy}
          className="sr-only"
          aria-invalid={uploadError || error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so picking the same file again still fires `change`.
            e.target.value = "";
            if (file) void onFile(file);
          }}
        />

        {uploadError ? (
          <p id={`${id}-upload-error`} role="alert" className={cn("text-sm text-destructive")}>
            {uploadError}
          </p>
        ) : null}

        {list ? (
          <MediaLibraryDialog
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            list={list}
            onPick={pickExisting}
          />
        ) : null}
      </div>
    );
  }

  return MediaInput;
}

interface MediaLibraryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly list: MediaLister;
  readonly onPick: (item: MediaValue) => void;
}

/**
 * "Choose existing" — a grid over the media library so an asset uploaded once
 * can be reused instead of uploaded again. Pages with the library's own cursor
 * and only fetches while open, so a form with ten media fields makes no
 * requests until someone actually browses.
 */
function MediaLibraryDialog({
  open,
  onOpenChange,
  list,
  onPick,
}: MediaLibraryDialogProps): ReactNode {
  const [items, setItems] = useState<ReadonlyArray<StoredMedia>>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (from?: string) => {
      setLoading(true);
      setFailed(false);
      try {
        const page = await list(from === undefined ? undefined : { cursor: from });
        setItems((prev) =>
          from === undefined
            ? (page.data as ReadonlyArray<StoredMedia>)
            : [...prev, ...(page.data as ReadonlyArray<StoredMedia>)],
        );
        setCursor(page.nextCursor);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [list],
  );

  // Refetch on each open: an asset uploaded in another tab (or in this form a
  // minute ago) should be there, and a stale grid of dead URLs is worse than a
  // short spinner.
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <Dialog.Header>
          <Dialog.Title>Choose existing</Dialog.Title>
          <Dialog.Description>Pick a file already in the media library.</Dialog.Description>
        </Dialog.Header>
        {failed ? (
          <p role="alert" className="text-destructive text-sm">
            Couldn't load the media library.
          </p>
        ) : null}
        {items.length === 0 && !loading && !failed ? (
          <p className="text-muted-foreground text-sm">Nothing uploaded yet.</p>
        ) : null}
        <div data-slot="media-library" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item)}
              className="group grid gap-1 rounded-md border p-1 text-left outline-none hover:border-ring focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Thumb media={item} className="h-20 w-full rounded object-cover" />
              <span className="truncate text-muted-foreground text-xs">{mediaFilename(item)}</span>
            </button>
          ))}
        </div>
        {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
        {cursor !== null && !loading ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void load(cursor)}>
            Load more
          </Button>
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
