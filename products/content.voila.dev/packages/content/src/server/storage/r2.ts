// Cloudflare R2 `Storage` over the Workers binding. The binding type is
// declared structurally (like `D1Binding` in the D1 driver) so
// `@cloudflare/workers-types` stays out of the dependency graph — pass
// `env.MY_BUCKET` straight in. Bindings expose no public URL, so there's no
// `signedUrl`; the REST serve route streams the bytes through the worker. For
// presigned R2 URLs, point the S3 adapter at R2's S3 API instead.

import type { Storage, StorageObject } from "./types";

/** The slice of an `R2Bucket` binding the adapter calls. */
export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; size?: number } | null>;
  delete(key: string): Promise<void>;
}

export function makeR2Storage(bucket: R2BucketLike): Storage {
  return {
    id: "r2",
    async put(key, body, opts) {
      await bucket.put(key, body, {
        httpMetadata: opts?.contentType ? { contentType: opts.contentType } : undefined,
      });
    },
    async get(key): Promise<StorageObject | null> {
      const object = await bucket.get(key);
      if (object === null) return null;
      const buffer = await object.arrayBuffer();
      return { body: new Uint8Array(buffer), size: object.size ?? buffer.byteLength };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
