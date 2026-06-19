// The `Storage` adapters. Memory and fs run the same put/get/delete contract
// (fs against a throwaway temp directory); R2 runs it against a structural
// stub bucket; S3 is exercised through a captured `fetch` — presigned URL
// shape, SigV4 signature determinism, and the byte/status mapping of each
// operation.

import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeFsStorage } from "./fs";
import { makeMemoryStorage } from "./memory";
import { makeR2Storage, type R2BucketLike } from "./r2";
import { makeS3Storage } from "./s3";
import type { Storage } from "./types";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

function contractTests(name: string, make: () => Storage): void {
  describe(`${name} contract`, () => {
    let storage: Storage;
    beforeEach(() => {
      storage = make();
    });

    it("round-trips an object", async () => {
      await storage.put("a/hello.txt", bytes("hi"), { contentType: "text/plain" });
      const object = await storage.get("a/hello.txt");
      expect(object).not.toBeNull();
      expect(new TextDecoder().decode(object?.body)).toBe("hi");
      expect(object?.size).toBe(2);
    });

    it("returns null for a missing key", async () => {
      expect(await storage.get("nope")).toBeNull();
    });

    it("overwrites an existing key", async () => {
      await storage.put("k", bytes("one"));
      await storage.put("k", bytes("two"));
      expect(new TextDecoder().decode((await storage.get("k"))?.body)).toBe("two");
    });

    it("deletes an object (and tolerates deleting a missing key)", async () => {
      await storage.put("k", bytes("x"));
      await storage.delete("k");
      expect(await storage.get("k")).toBeNull();
      await storage.delete("k");
    });
  });
}

contractTests("memory", () => makeMemoryStorage());

describe("fs", () => {
  // A fresh subdirectory per `make()` keeps tests isolated; the adapter creates
  // it lazily on first write. One recursive cleanup at the end.
  const root = join(tmpdir(), `voila-storage-tests-${process.pid}`);
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  contractTests("fs", () => makeFsStorage({ directory: join(root, crypto.randomUUID()) }));

  it("rejects a key escaping the storage directory", async () => {
    const storage = makeFsStorage({ directory: join(root, "jail") });
    expect(storage.put("../escape.txt", bytes("x"))).rejects.toThrow(/escapes/);
  });
});

describe("memory isolation", () => {
  it("copies the buffer on put so later mutation can't alter the store", async () => {
    const storage = makeMemoryStorage();
    const buffer = bytes("abc");
    await storage.put("k", buffer);
    buffer[0] = 0;
    expect(new TextDecoder().decode((await storage.get("k"))?.body)).toBe("abc");
  });
});

describe("r2", () => {
  function stubBucket(): { bucket: R2BucketLike; objects: Map<string, Uint8Array> } {
    const objects = new Map<string, Uint8Array>();
    const bucket: R2BucketLike = {
      async put(key, value) {
        objects.set(key, value instanceof Uint8Array ? value : new Uint8Array(value));
      },
      async get(key) {
        const stored = objects.get(key);
        if (stored === undefined) return null;
        return {
          arrayBuffer: async () =>
            stored.buffer.slice(stored.byteOffset, stored.byteOffset + stored.byteLength),
          size: stored.byteLength,
        };
      },
      async delete(key) {
        objects.delete(key);
      },
    };
    return { bucket, objects };
  }

  contractTests("r2", () => makeR2Storage(stubBucket().bucket));

  it("forwards the content type into httpMetadata", async () => {
    const calls: Array<unknown> = [];
    const storage = makeR2Storage({
      async put(_key, _value, options) {
        calls.push(options);
      },
      async get() {
        return null;
      },
      async delete() {},
    });
    await storage.put("k", bytes("x"), { contentType: "image/png" });
    expect(calls[0]).toEqual({ httpMetadata: { contentType: "image/png" } });
  });
});

describe("s3", () => {
  interface CapturedRequest {
    readonly url: URL;
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body: Uint8Array | null;
  }

  function capture(respond: (req: CapturedRequest) => Response): {
    requests: CapturedRequest[];
    fetch: typeof fetch;
  } {
    const requests: CapturedRequest[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input as string, init);
      const raw = init?.body;
      const captured: CapturedRequest = {
        url: new URL(request.url),
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: raw instanceof Uint8Array ? raw : null,
      };
      requests.push(captured);
      return respond(captured);
    }) as typeof fetch;
    return { requests, fetch: fetchImpl };
  }

  const FIXED_NOW = Date.UTC(2026, 5, 11, 12, 0, 0); // 2026-06-11T12:00:00Z

  function makeStorage(respond: (req: CapturedRequest) => Response) {
    const { requests, fetch: fetchImpl } = capture(respond);
    const storage = makeS3Storage({
      bucket: "uploads",
      region: "auto",
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "secret",
      endpoint: "https://acc.r2.cloudflarestorage.com",
      fetch: fetchImpl,
      now: () => FIXED_NOW,
    });
    return { storage, requests };
  }

  it("presigns a GET with the SigV4 query parameters", async () => {
    const { storage } = makeStorage(() => new Response(null));
    if (!storage.signedUrl) throw new Error("s3 storage must sign URLs");
    const url = new URL(await storage.signedUrl("a/b.png", { expiresIn: 600 }));
    expect(url.origin).toBe("https://acc.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/uploads/a/b.png");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(
      "AKIDEXAMPLE/20260611/auto/s3/aws4_request",
    );
    expect(url.searchParams.get("X-Amz-Date")).toBe("20260611T120000Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs deterministically (same inputs, same signature) and varies by key", async () => {
    const { storage } = makeStorage(() => new Response(null));
    if (!storage.signedUrl) throw new Error("s3 storage must sign URLs");
    const a = await storage.signedUrl("k.txt", { expiresIn: 60 });
    const b = await storage.signedUrl("k.txt", { expiresIn: 60 });
    const other = await storage.signedUrl("other.txt", { expiresIn: 60 });
    expect(a).toBe(b);
    expect(new URL(a).searchParams.get("X-Amz-Signature")).not.toBe(
      new URL(other).searchParams.get("X-Amz-Signature"),
    );
  });

  it("PUTs the bytes to a presigned URL with the content type unsigned", async () => {
    const { storage, requests } = makeStorage(() => new Response(null, { status: 200 }));
    await storage.put("a/x.png", bytes("png!"), { contentType: "image/png" });
    const request = requests[0];
    expect(request?.method).toBe("PUT");
    expect(request?.url.pathname).toBe("/uploads/a/x.png");
    expect(request?.headers["content-type"]).toBe("image/png");
    expect(new TextDecoder().decode(request?.body ?? new Uint8Array())).toBe("png!");
  });

  it("maps GET 404 to null and other failures to errors", async () => {
    const missing = makeStorage(() => new Response(null, { status: 404 }));
    expect(await missing.storage.get("nope")).toBeNull();

    const broken = makeStorage(() => new Response(null, { status: 500 }));
    expect(broken.storage.get("k")).rejects.toThrow(/failed: 500/);
    expect(broken.storage.put("k", bytes("x"))).rejects.toThrow(/failed: 500/);
  });

  it("reads an object's bytes back from a GET", async () => {
    const { storage } = makeStorage(() => new Response(bytes("body"), { status: 200 }));
    const object = await storage.get("k");
    expect(new TextDecoder().decode(object?.body)).toBe("body");
  });

  it("treats DELETE 404 as a no-op", async () => {
    const { storage } = makeStorage(() => new Response(null, { status: 404 }));
    await storage.delete("nope");
  });

  it("defaults to the AWS regional endpoint", async () => {
    const { requests, fetch: fetchImpl } = capture(() => new Response(null, { status: 200 }));
    const storage = makeS3Storage({
      bucket: "b",
      region: "eu-west-1",
      accessKeyId: "k",
      secretAccessKey: "s",
      fetch: fetchImpl,
      now: () => FIXED_NOW,
    });
    await storage.delete("x");
    expect(requests[0]?.url.origin).toBe("https://s3.eu-west-1.amazonaws.com");
  });
});
