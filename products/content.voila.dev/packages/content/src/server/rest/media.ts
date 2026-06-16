// The media routes — upload, library list, record fetch, file serve, delete —
// over the `Storage` seam + `MediaStore`. Mounted under the reserved `_media`
// segment (the leading underscore keeps it out of the collection-slug
// namespace) and only when the host wires a `media` context; without one the
// dispatcher doesn't own the routes at all.
//
// Bytes and metadata split on write: the upload streams into `Storage` under
// an engine-minted key (`<uuid>/<sanitized filename>`), the metadata row goes
// to `voila_media`, and the response is a `MediaValue` — the exact shape a
// media *field* stores in a document, so the admin form can paste it straight
// into a write payload. Serving prefers a 302 to a backend-signed URL
// (S3-style adapters) and falls back to streaming the bytes through the app.

import type { MediaValue } from "../../config/schema/fields";
import type { MediaListOpts, MediaRecord, MediaStore } from "../media/store";
import type { Storage } from "../storage";
import { badRequest, fail, notFound, tooLarge } from "./errors";
import { type RestErrorHook, runHandler } from "./handlers";

/** What the media routes need from the host: bytes + records + limits. */
export interface MediaContext {
  readonly storage: Storage;
  readonly store: MediaStore;
  /** Upload size cap in bytes. Default 50 MiB. */
  readonly maxBytes?: number;
  /** Lifetime of backend-signed file URLs, in seconds. Default 900 (15 min). */
  readonly signedUrlExpiresIn?: number;
  /** Observes unexpected errors before they fold to `INTERNAL` (see `RestErrorHook`). */
  readonly onError?: RestErrorHook;
}

/** The reserved route segment (and the `collection` the RBAC hook sees). */
export const MEDIA_SEGMENT = "_media";

const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_SIGNED_URL_EXPIRES_IN = 900;

// Keep the original name readable in the storage key but make it path- and
// header-safe: basename only, conservative character set.
export function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const safe = base.replace(/[^\w.-]+/g, "_").replace(/^[.]+/, "");
  return safe.length > 0 ? safe.slice(0, 128) : "file";
}

/** The app-relative URL `GET …/_media/:id/file` serves the bytes from. */
function fileUrl(basePath: string, id: string): string {
  return `${basePath}/${MEDIA_SEGMENT}/${encodeURIComponent(id)}/file`;
}

// The wire shape of a media record: the row plus its serve URL — a superset of
// the `MediaValue` a media field stores.
function toMediaValue(record: MediaRecord, basePath: string): MediaValue & MediaRecord {
  return { ...record, url: fileUrl(basePath, record.id) };
}

// Pull `{ file, alt?, width?, height? }` out of a multipart body. Anything that
// isn't multipart, lacks a file part, or carries malformed dimensions is a 400.
async function parseUpload(request: Request): Promise<{
  readonly file: File;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
}> {
  // Inferred (undici/Bun) `FormData` type — the package compiles without DOM libs.
  let form: Awaited<ReturnType<Request["formData"]>>;
  try {
    form = await request.formData();
  } catch {
    return fail(badRequest({ reason: "expected a multipart/form-data body" }));
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail(badRequest({ field: "file", reason: "expected a file part" }));
  }
  const alt = form.get("alt");
  const dimension = (name: string): number | undefined => {
    const raw = form.get(name);
    if (raw === null) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1) {
      fail(badRequest({ field: name, expected: "positive integer" }));
    }
    return value;
  };
  return {
    file,
    alt: typeof alt === "string" && alt.length > 0 ? alt : undefined,
    width: dimension("width"),
    height: dimension("height"),
  };
}

/** `POST /_media` — multipart upload (`file` + optional `alt`/`width`/`height`).
 *  Returns the stored record as a `MediaValue` (201). */
export function handleMediaUpload(
  media: MediaContext,
  request: Request,
  basePath: string,
): Promise<Response> {
  return runHandler(async () => {
    const upload = await parseUpload(request);
    const maxBytes = media.maxBytes ?? DEFAULT_MAX_BYTES;
    if (upload.file.size > maxBytes) fail(tooLarge(maxBytes, upload.file.size));

    const id = crypto.randomUUID();
    const filename = sanitizeFilename(upload.file.name);
    const key = `${id}/${filename}`;
    const mime = upload.file.type || "application/octet-stream";
    const body = new Uint8Array(await upload.file.arrayBuffer());

    await media.storage.put(key, body, { contentType: mime });
    const record = await media.store.insert({
      id,
      key,
      filename,
      mime,
      size: body.byteLength,
      width: upload.width,
      height: upload.height,
      alt: upload.alt,
    });
    return Response.json({ data: toMediaValue(record, basePath) }, { status: 201 });
  }, media.onError);
}

/** `GET /_media` — page through the library, newest upload first. */
export function handleMediaList(
  media: MediaContext,
  url: URL,
  basePath: string,
): Promise<Response> {
  return runHandler(async () => {
    const opts: MediaListOpts = {};
    const limit = url.searchParams.get("limit");
    if (limit !== null) {
      const value = Number(limit);
      if (!Number.isInteger(value) || value < 1) {
        fail(badRequest({ field: "limit", expected: "positive integer" }));
      }
      (opts as { limit?: number }).limit = value;
    }
    const cursor = url.searchParams.get("cursor");
    if (cursor !== null) (opts as { cursor?: string }).cursor = cursor;

    const result = await media.store.list(opts);
    return Response.json({
      data: result.records.map((record) => toMediaValue(record, basePath)),
      nextCursor: result.nextCursor,
    });
  }, media.onError);
}

/** `GET /_media/:id` — fetch one record (metadata, not bytes). */
export function handleMediaGet(
  media: MediaContext,
  id: string,
  basePath: string,
): Promise<Response> {
  return runHandler(async () => {
    const record = await media.store.get(id);
    if (record === null) fail(notFound(MEDIA_SEGMENT));
    return Response.json({ data: toMediaValue(record, basePath) });
  }, media.onError);
}

/** `GET /_media/:id/file` — the bytes: a 302 to a backend-signed URL when the
 *  adapter can mint one, else streamed through the app with the record's mime. */
export function handleMediaFile(media: MediaContext, id: string): Promise<Response> {
  return runHandler(async () => {
    const record = await media.store.get(id);
    if (record === null) fail(notFound(MEDIA_SEGMENT));

    if (media.storage.signedUrl) {
      const url = await media.storage.signedUrl(record.key, {
        expiresIn: media.signedUrlExpiresIn ?? DEFAULT_SIGNED_URL_EXPIRES_IN,
      });
      return new Response(null, { status: 302, headers: { location: url } });
    }

    const object = await media.storage.get(record.key);
    if (object === null) fail(notFound(MEDIA_SEGMENT));
    return new Response(object.body, {
      headers: {
        "content-type": record.mime,
        "content-length": String(object.size ?? object.body.byteLength),
      },
    });
  }, media.onError);
}

/** `DELETE /_media/:id` — remove the bytes and the record. */
export function handleMediaDelete(media: MediaContext, id: string): Promise<Response> {
  return runHandler(async () => {
    const record = await media.store.get(id);
    if (record === null) fail(notFound(MEDIA_SEGMENT));
    await media.storage.delete(record.key);
    await media.store.delete(id);
    return Response.json({ data: { id } });
  }, media.onError);
}
