// S3-compatible `Storage` over plain HTTP — covers AWS S3, Cloudflare R2's S3
// API, and MinIO from one adapter. Every operation runs against a SigV4
// *presigned* URL (query-string auth, UNSIGNED-PAYLOAD) built with Web Crypto,
// so it works on Workers, Bun, and Node with no AWS SDK. `signedUrl` exposes
// the same presigned GET to the REST serve route, which 302s browsers straight
// to the bucket instead of streaming bytes through the app.
//
// Path-style addressing (`https://endpoint/bucket/key`) throughout: required
// by R2/MinIO endpoints and still accepted by AWS.

import type { SignedUrlOpts, Storage, StorageObject, StoragePutOpts } from "./types";

export interface S3StorageOpts {
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** Origin of the S3 API (e.g. `https://<account>.r2.cloudflarestorage.com`,
   *  `http://localhost:9000`). Defaults to AWS's regional endpoint. */
  readonly endpoint?: string;
  /** Fetch implementation; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Clock returning epoch ms — injectable for deterministic signing tests. */
  readonly now?: () => number;
}

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function sha256Hex(payload: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  return toHex(new Uint8Array(digest));
}

async function hmac(key: Uint8Array | string, payload: string): Promise<Uint8Array> {
  const keyData = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload)));
}

// Strict RFC 3986 encoding — SigV4 rejects the characters `encodeURIComponent`
// leaves bare (`!'()*`).
function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// An S3 canonical URI keeps `/` separators but encodes each segment.
function canonicalUri(path: string): string {
  return path
    .split("/")
    .map((segment) => rfc3986(segment))
    .join("/");
}

function amzTimestamp(epochMs: number): { amzDate: string; dateStamp: string } {
  const iso = new Date(epochMs).toISOString(); // 2026-06-11T12:34:56.789Z
  const amzDate = `${iso.slice(0, 19).replace(/[-:]/g, "")}Z`;
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

/**
 * Build a SigV4-presigned URL for one request. Only `host` is signed, so a
 * caller may attach unsigned headers (e.g. `content-type` on a PUT) without
 * invalidating the signature — standard presigned-URL behavior.
 */
async function presign(
  opts: Required<Pick<S3StorageOpts, "bucket" | "region" | "accessKeyId" | "secretAccessKey">> & {
    endpoint: string;
    method: string;
    key: string;
    expiresIn: number;
    epochMs: number;
  },
): Promise<string> {
  const url = new URL(opts.endpoint);
  const path = `/${opts.bucket}/${opts.key}`;
  const { amzDate, dateStamp } = amzTimestamp(opts.epochMs);
  const scope = `${dateStamp}/${opts.region}/s3/aws4_request`;

  const query: Array<[string, string]> = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${opts.accessKeyId}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(opts.expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  const canonicalQuery = query
    .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
    .sort()
    .join("&");

  const canonicalRequest = [
    opts.method,
    canonicalUri(path),
    canonicalQuery,
    `host:${url.host}`,
    "",
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join(
    "\n",
  );

  let signingKey = await hmac(`AWS4${opts.secretAccessKey}`, dateStamp);
  for (const part of [opts.region, "s3", "aws4_request"]) {
    signingKey = await hmac(signingKey, part);
  }
  const signature = toHex(await hmac(signingKey, stringToSign));

  return `${url.origin}${canonicalUri(path)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function makeS3Storage(opts: S3StorageOpts): Storage {
  const endpoint = opts.endpoint ?? `https://s3.${opts.region}.amazonaws.com`;
  const fetchImpl = opts.fetch ?? globalThis.fetch;
  const now = opts.now ?? Date.now;

  const sign = (method: string, key: string, expiresIn: number): Promise<string> =>
    presign({
      bucket: opts.bucket,
      region: opts.region,
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      endpoint,
      method,
      key,
      expiresIn,
      epochMs: now(),
    });

  return {
    id: "s3",
    async put(key: string, body: Uint8Array, putOpts?: StoragePutOpts) {
      const url = await sign("PUT", key, 300);
      const res = await fetchImpl(url, {
        method: "PUT",
        headers: putOpts?.contentType ? { "content-type": putOpts.contentType } : undefined,
        body,
      });
      if (!res.ok) throw new Error(`S3 PUT "${key}" failed: ${res.status}`);
    },
    async get(key: string): Promise<StorageObject | null> {
      const url = await sign("GET", key, 300);
      const res = await fetchImpl(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`S3 GET "${key}" failed: ${res.status}`);
      const body = new Uint8Array(await res.arrayBuffer());
      return { body, size: body.byteLength };
    },
    async delete(key: string) {
      const url = await sign("DELETE", key, 300);
      const res = await fetchImpl(url, { method: "DELETE" });
      // 404 on delete is a no-op by the seam's contract.
      if (!res.ok && res.status !== 404)
        throw new Error(`S3 DELETE "${key}" failed: ${res.status}`);
    },
    signedUrl(key: string, urlOpts: SignedUrlOpts): Promise<string> {
      return sign("GET", key, urlOpts.expiresIn);
    },
  };
}
