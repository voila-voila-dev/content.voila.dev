/**
 * CSRF protection via a **signed double-submit cookie**.
 *
 * The server issues a token in a *non-`HttpOnly`* cookie (`voila_csrf`) so
 * same-origin admin JS can read it back and echo it in a custom request header
 * (`x-voila-csrf`) on every state-changing call. A cross-site attacker can ride
 * the session cookie but cannot read the CSRF cookie to reproduce the header,
 * nor set a custom header on a cross-site form post.
 *
 * The token is `<random>.<sig>` where `sig = HMAC-SHA256(secret, random)`. On
 * top of the cookie/header equality check (constant-time), every write
 * re-verifies the signature with the server secret. The signature is what
 * defeats **cookie injection**: an attacker who can plant a `voila_csrf` cookie
 * (e.g. from a sibling subdomain, or via MITM on a non-HTTPS origin) still
 * can't forge a token with a valid HMAC, so verification fails closed. The
 * naive equality-only double-submit is vulnerable to exactly that — signing
 * closes the gap.
 *
 * Pure module: no database, no framework. The write handlers call
 * `verifyCsrf(request, secret)`; the `/admin/api/csrf` route calls `issueCsrf`.
 * The secret is the deployment's `VOILA_AUTH_SECRET` (already required for
 * auth), passed in by the generated routes so this module reads no env itself.
 */

import { err, ok, type Result } from "../shared/result.ts";
import { type CsrfError, csrfFailed } from "./errors.ts";

/** Cookie the server sets and the client reads for the double-submit token. */
export const CSRF_COOKIE = "voila_csrf";
/** Header the client echoes the cookie value back in on writes. */
export const CSRF_HEADER = "x-voila-csrf";

/** 32 random bytes ⇒ 43 base64url chars for the unsigned payload. */
const RANDOM_BYTES = 32;
/** Cookie lifetime. Long enough to outlive a working session; refreshed on issue. */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();
// Importing an HMAC key is the per-call cost; cache one CryptoKey per secret.
const keyCache = new Map<string, Promise<CryptoKey>>();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keyCache.get(secret);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    keyCache.set(secret, key);
  }
  return key;
}

async function sign(payload: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return base64url(new Uint8Array(signature));
}

/** Split a `<payload>.<sig>` token, or `undefined` if it isn't that shape. */
function splitToken(token: string): { payload: string; sig: string } | undefined {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return undefined;
  return { payload: token.slice(0, dot), sig: token.slice(dot + 1) };
}

/** Whether a token's signature matches the secret (constant-time). */
async function isValidToken(token: string, secret: string): Promise<boolean> {
  const parts = splitToken(token);
  if (!parts) return false;
  return timingSafeEqual(parts.sig, await sign(parts.payload, secret));
}

/** Mint a fresh signed token: `<random>.<HMAC(random)>`. */
export async function generateCsrfToken(secret: string): Promise<string> {
  const bytes = new Uint8Array(RANDOM_BYTES);
  crypto.getRandomValues(bytes);
  const payload = base64url(bytes);
  return `${payload}.${await sign(payload, secret)}`;
}

/** Read a single cookie value off a request's `Cookie` header. */
export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * Build the `Set-Cookie` value for the CSRF token. Deliberately omits
 * `HttpOnly` — the client must read it to populate the header. `secure` is
 * derived from the request scheme so local `http` dev keeps working while
 * production stays `Secure`.
 */
export function csrfSetCookie(token: string, options: { secure: boolean }): string {
  const attrs = [
    `${CSRF_COOKIE}=${token}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (options.secure) attrs.push("Secure");
  return attrs.join("; ");
}

/**
 * Resolve the token to publish for a request: reuse the existing cookie when
 * its signature still verifies (keeps it stable across tabs and calls), else
 * mint a new one. Returns the token plus whether it changed, so the caller only
 * re-sets the cookie when needed.
 */
export async function issueCsrf(
  request: Request,
  secret: string,
): Promise<{ token: string; isNew: boolean }> {
  const existing = readCookie(request, CSRF_COOKIE);
  if (existing && (await isValidToken(existing, secret))) {
    return { token: existing, isNew: false };
  }
  return { token: await generateCsrfToken(secret), isNew: true };
}

/**
 * Verify a state-changing request carries a matching, validly-signed token in
 * both the cookie and the header. Fails closed: a missing cookie/header, a
 * cookie≠header mismatch, or a bad signature is a `CSRF` failure (403).
 */
export async function verifyCsrf(
  request: Request,
  secret: string,
): Promise<Result<void, CsrfError>> {
  const cookie = readCookie(request, CSRF_COOKIE);
  const header = request.headers.get(CSRF_HEADER) ?? undefined;
  if (!cookie || !header) return err(csrfFailed());
  // Double-submit: the header must echo the cookie...
  if (!timingSafeEqual(cookie, header)) return err(csrfFailed());
  // ...and the token must carry our signature (defeats cookie injection).
  if (!(await isValidToken(cookie, secret))) return err(csrfFailed());
  return ok(undefined);
}

/**
 * Length-aware constant-time string comparison. Compares every character even
 * once a mismatch is found so the runtime can't be used to recover the token
 * byte by byte. Differing lengths short-circuit to `false` (a length leak is
 * not useful against a high-entropy token).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Whether a request's origin is `https` (drives the cookie `Secure` flag). */
export function isSecureRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
