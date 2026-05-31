// HMAC double-submit CSRF for mutation procedures. The browser mints a token
// (`mintCsrfToken`) which the host serves as a JS-readable `voila_csrf` cookie and
// the client echoes back in the `x-voila-csrf` header. `CsrfMiddleware` (attached
// per write-Rpc) verifies the header equals the cookie *and* that the token's HMAC
// signature is valid under the config `secret` — so a cross-site attacker, unable to
// read the cookie or forge the signature, cannot mint a request. Reads carry only
// `SessionMiddleware`; this never touches them.
//
// Signing uses Web Crypto (`crypto.subtle`), available in both workerd and Bun.

import { RpcMiddleware } from "@effect/rpc";
import { Effect, Layer } from "effect";
import { Forbidden } from "./errors";

/** Cookie + header names the double-submit pair travels under. */
export const CSRF_COOKIE = "voila_csrf";
export const CSRF_HEADER = "x-voila-csrf";

/** RPC middleware tag for mutations: fails with `Forbidden`, provides nothing. */
export class CsrfMiddleware extends RpcMiddleware.Tag<CsrfMiddleware>()(
  "@voila/content/CsrfMiddleware",
  { failure: Forbidden },
) {}

const textEncoder = new TextEncoder();

const base64url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const signNonce = async (secret: string, nonce: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(nonce));
  return base64url(new Uint8Array(signature));
};

// Length-then-XOR comparison so a mismatch doesn't leak position via timing.
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const verifyToken = async (secret: string, token: string): Promise<boolean> => {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const expected = await signNonce(secret, token.slice(0, dot));
  return timingSafeEqual(token.slice(dot + 1), expected);
};

const readCookie = (cookieHeader: string | null, name: string): string | undefined => {
  if (cookieHeader === null) return undefined;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
};

/** Mint a fresh `nonce.signature` token to set as the cookie and echo in the header. */
export const mintCsrfToken = async (secret: string): Promise<string> => {
  const nonce = crypto.randomUUID();
  return `${nonce}.${await signNonce(secret, nonce)}`;
};

const enforce = (secret: string, headers: Record<string, string>): Effect.Effect<void, Forbidden> =>
  Effect.gen(function* () {
    const wire = new Headers(headers);
    const header = wire.get(CSRF_HEADER);
    const cookie = readCookie(wire.get("cookie"), CSRF_COOKIE);
    if (header === null || cookie === undefined) {
      return yield* Effect.fail(new Forbidden({ message: "Missing CSRF token." }));
    }
    if (!timingSafeEqual(header, cookie)) {
      return yield* Effect.fail(new Forbidden({ message: "CSRF token mismatch." }));
    }
    const valid = yield* Effect.promise(() => verifyToken(secret, header));
    if (!valid) return yield* Effect.fail(new Forbidden({ message: "Invalid CSRF token." }));
  });

/** Enforcing `CsrfMiddleware` over the signing `secret`. */
export const CsrfMiddlewareLive = (secret: string): Layer.Layer<CsrfMiddleware> =>
  Layer.succeed(CsrfMiddleware, ({ headers }) => enforce(secret, headers));

/** Permissive `CsrfMiddleware` for tests / unauthenticated read-only mounts. */
export const CsrfMiddlewareTestLive: Layer.Layer<CsrfMiddleware> = Layer.succeed(
  CsrfMiddleware,
  () => Effect.void,
);
