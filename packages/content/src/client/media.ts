// The media client — a thin `fetch` over the `_media` routes. Standalone
// (`makeMediaClient`, not a key on `ContentClient`) so it can never collide
// with a collection slug; pair it with the same `baseUrl`/`fetch` you hand
// `makeClient`. Upload takes any `Blob`/`File` and returns the stored
// `MediaRecord` + serve `url` — exactly the `MediaValue` shape a media field
// stores, ready to drop into a document write.

import type { MediaValue } from "../config/schema/fields";
import type { ClientOptions } from "./client";
import { type ApiFailure, ContentClientError } from "./errors";

/** A stored upload as the wire returns it: the record plus its serve URL. */
export interface MediaItem extends MediaValue {
  readonly key: string;
  readonly filename: string;
  readonly createdAt: number;
}

export interface MediaUploadOpts {
  /** Name stored with the file. Defaults to the `File`'s own name (or `file`). */
  readonly filename?: string;
  readonly alt?: string;
  /** Pixel dimensions, when the uploader knows them (e.g. read in the browser). */
  readonly width?: number;
  readonly height?: number;
}

export interface MediaListParams {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface MediaListPage {
  readonly data: ReadonlyArray<MediaItem>;
  readonly nextCursor: string | null;
}

export interface MediaClient {
  /** Upload a file (multipart); returns the stored record (its `id`/`url`/`mime`/
   *  `size`/`alt` are the `MediaValue` a media field stores). */
  upload(file: Blob, opts?: MediaUploadOpts): Promise<MediaItem>;
  /** Fetch one record's metadata, or `null` when the id is unknown. */
  get(id: string): Promise<MediaItem | null>;
  /** Page through the library, newest upload first. */
  list(params?: MediaListParams): Promise<MediaListPage>;
  /** Delete the bytes and the record. */
  delete(id: string): Promise<void>;
  /** The app-relative URL the bytes are served from (no request made). */
  fileUrl(id: string): string;
}

interface Envelope {
  readonly data?: unknown;
  readonly nextCursor?: string | null;
  readonly error?: ApiFailure;
  /** The server's human-readable summary of `error` (see `failureMessage`). */
  readonly message?: string;
}

const INTERNAL: ApiFailure = { code: "INTERNAL" };

export function makeMediaClient(options: ClientOptions): MediaClient {
  const base = options.baseUrl.endsWith("/") ? options.baseUrl.slice(0, -1) : options.baseUrl;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const root = `${base}/_media`;

  const send = async <T>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetchImpl(url, init);
    const body = (await res.json()) as Envelope;
    if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
    return body.data as T;
  };

  return {
    async upload(file, opts) {
      const form = new FormData();
      const filename = opts?.filename ?? (file instanceof File ? file.name : "file");
      form.append("file", file, filename);
      if (opts?.alt !== undefined) form.append("alt", opts.alt);
      if (opts?.width !== undefined) form.append("width", String(opts.width));
      if (opts?.height !== undefined) form.append("height", String(opts.height));
      return send<MediaItem>(root, { method: "POST", body: form });
    },

    async get(id) {
      const res = await fetchImpl(`${root}/${encodeURIComponent(id)}`);
      const body = (await res.json()) as Envelope;
      if (res.ok) return body.data as MediaItem;
      if (res.status === 404 && body.error?.code === "NOT_FOUND") return null;
      throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
    },

    async list(params) {
      const qs = new URLSearchParams();
      if (params?.limit !== undefined) qs.set("limit", String(params.limit));
      if (params?.cursor !== undefined) qs.set("cursor", params.cursor);
      const query = qs.toString();
      const res = await fetchImpl(`${root}${query ? `?${query}` : ""}`);
      const body = (await res.json()) as Envelope;
      if (!res.ok) throw new ContentClientError(res.status, body.error ?? INTERNAL, body.message);
      return {
        data: (body.data as ReadonlyArray<MediaItem>) ?? [],
        nextCursor: body.nextCursor ?? null,
      };
    },

    async delete(id) {
      await send<unknown>(`${root}/${encodeURIComponent(id)}`, { method: "DELETE" });
    },

    fileUrl(id) {
      return `${root}/${encodeURIComponent(id)}/file`;
    },
  };
}
