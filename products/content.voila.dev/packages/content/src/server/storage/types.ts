// The `Storage` seam — where uploaded bytes live. Mirrors the `SqlDriver`/
// `Mailer` pattern: the engine ships the seam plus ready adapters (in-memory,
// filesystem, Cloudflare R2 binding, S3-compatible HTTP), and a host can plug
// in anything else. Object *metadata* (mime, size, filename, alt) lives in the
// engine-owned `voila_media` table, not here — an adapter only has to move
// bytes for a key.

export interface StoragePutOpts {
  /** MIME type stored alongside the object where the backend supports it
   *  (R2/S3 honor it on direct/signed access; memory/fs ignore it — the REST
   *  serve route sets `Content-Type` from the media record instead). */
  readonly contentType?: string;
}

// Bytes are `Uint8Array<ArrayBuffer>` (not the bare `Uint8Array`, which TS 5.7+
// widens to `Uint8Array<ArrayBufferLike>`): storage objects are always backed by
// a regular `ArrayBuffer`, never a `SharedArrayBuffer`, so a consumer compiling
// this source under the DOM lib can hand `body` straight to `Response`/`fetch`
// (whose `BodyInit`/`BufferSource` reject the shared-buffer-backed variant).
type StorageBytes = Uint8Array<ArrayBuffer>;

/** An object read back from storage. */
export interface StorageObject {
  readonly body: StorageBytes;
  /** Byte length, when the backend reports it without reading the body. */
  readonly size?: number;
}

export interface Storage {
  /** Stable adapter name used in logs and diagnostics. */
  readonly id: string;
  /** Write an object (overwrites an existing key). */
  put(key: string, body: StorageBytes, opts?: StoragePutOpts): Promise<void>;
  /** Read an object, or `null` when the key doesn't exist. */
  get(key: string): Promise<StorageObject | null>;
  /** Remove an object. Deleting a missing key is a no-op. */
  delete(key: string): Promise<void>;
  /**
   * Time-limited URL a browser can fetch the object from directly, bypassing
   * the REST route. Optional: backends with no URL surface (memory, fs, R2
   * bindings) omit it and the serve route streams the bytes instead.
   */
  signedUrl?(key: string, opts: SignedUrlOpts): Promise<string>;
}

export interface SignedUrlOpts {
  /** Seconds the URL stays valid. */
  readonly expiresIn: number;
}
