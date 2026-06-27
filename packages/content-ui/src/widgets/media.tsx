// Media widgets — the read display and the upload-backed edit input for a
// `media` field (`fields.media()`, value shape `MediaValue`). The display is
// pure and ships in the default registry. The edit widget needs a way to put
// bytes somewhere, which `@voila/content-ui` deliberately doesn't know about
// (it stays client-free), so it's a *factory*: the host passes an `upload`
// function (e.g. wrapping `makeMediaClient(...).upload`) and gets back an
// `EditWidget` to drop into `mergeEditRegistry({ media: … })`. The widget owns
// the upload/replace/remove flow and the alt-text input; on success it emits the
// stored `MediaValue` so the form re-validates it against the field's schema.

import type { MediaValue } from "@voila/content";
import { Button } from "@voila/ui/button";
import { cn } from "@voila/ui/cn";
import { Input } from "@voila/ui/input";
import { type ReactNode, useRef, useState } from "react";
import type { DisplayWidgetProps } from "./display";
import { Empty } from "./display";
import type { EditWidget, EditWidgetProps } from "./edit";

/** The `media` field's `meta` carries the uploader's accept globs and size cap. */
interface MediaMetaShape {
  readonly accept?: ReadonlyArray<string>;
  readonly max?: number;
}

/** Narrow an unknown value to a stored `MediaValue` (has at least a `url`). */
function asMedia(value: unknown): MediaValue | null {
  if (value === null || typeof value !== "object") return null;
  const v = value as { url?: unknown };
  return typeof v.url === "string" ? (value as MediaValue) : null;
}

function isImage(media: MediaValue): boolean {
  return typeof media.mime === "string" && media.mime.startsWith("image/");
}

/** Compact human size (`1.2 MB`) for the file caption — never throws on junk. */
function formatBytes(bytes: unknown): string | null {
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

// ---------- display ----------

/**
 * Read-only render of a media value: an image thumbnail (when the mime is an
 * image), else the file's mime as a label, with the byte size as a caption. The
 * thumbnail/label links through to the asset (new tab) so the value is more than
 * a dead preview. Registered for the `media` kind in the default display registry.
 */
export function MediaDisplay({ value }: DisplayWidgetProps): ReactNode {
  const media = asMedia(value);
  if (media === null) return <Empty />;
  const size = formatBytes(media.size);
  return (
    <span data-slot="media-display" className="inline-flex items-center gap-2 align-middle">
      <a
        href={media.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isImage(media) ? (
          <img
            src={media.url}
            alt={media.alt ?? ""}
            className="h-10 w-10 shrink-0 rounded border object-cover"
          />
        ) : (
          <span className="rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline">
            {media.mime || "file"}
          </span>
        )}
      </a>
      {size ? <span className="text-xs text-muted-foreground">{size}</span> : null}
    </span>
  );
}

// ---------- edit ----------

/** Uploads a file and resolves to the stored `MediaValue` (what a media field
 *  holds). Wrap your media client, e.g. `(file) => mediaClient.upload(file)`. */
export type MediaUploader = (file: File, opts?: { alt?: string }) => Promise<MediaValue>;

export interface CreateMediaInputOptions {
  readonly upload: MediaUploader;
}

/**
 * Build a `media` edit widget bound to an `upload` function. Register it on a
 * form's edit registry: `mergeEditRegistry({ media: createMediaInput({ upload }) })`.
 * The returned widget uploads on file pick, previews the result, lets the user
 * edit alt text or replace/remove the file, and emits the stored `MediaValue`.
 */
export function createMediaInput(options: CreateMediaInputOptions): EditWidget {
  const { upload } = options;

  function MediaInput({ value, onChange, field, id, error, disabled }: EditWidgetProps): ReactNode {
    const media = asMedia(value);
    const meta = field.meta as MediaMetaShape;
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

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
        setUploadError(`File is too large (max ${formatBytes(meta.max)}).`);
        return;
      }
      setBusy(true);
      try {
        const stored = await upload(file);
        onChange(stored);
      } catch (cause) {
        setUploadError(cause instanceof Error ? cause.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div data-slot="media-input" className="space-y-2">
        {media !== null ? (
          <div className="flex items-start gap-3">
            {isImage(media) ? (
              <img
                src={media.url}
                alt={media.alt ?? ""}
                className="h-16 w-16 shrink-0 rounded border object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                {media.mime || "file"}
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Input
                aria-label="Alt text"
                placeholder="Describe this media (alt text)"
                value={media.alt ?? ""}
                disabled={disabled || busy}
                onChange={(e) => onChange({ ...media, alt: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || busy}
                  onClick={() => inputRef.current?.click()}
                >
                  {busy ? "Uploading…" : "Replace"}
                </Button>
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
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : "Upload"}
          </Button>
        )}

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
      </div>
    );
  }

  return MediaInput;
}
