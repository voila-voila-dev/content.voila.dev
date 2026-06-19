// CSRF protection for mutating requests: a *signed* double-submit token. The
// token is `<random>.<hmac(secret, random)>`; the host sets it as a cookie and
// echoes it in a request header. On every mutating request the engine checks
// that (a) both copies are present, (b) they match, and (c) the signature
// verifies against the shared secret.
//
// Why signed and not a bare double-submit: a plain double-submit trusts that an
// attacker can't set the cookie, which a sibling-subdomain or cookie-injection
// foothold breaks. Binding the token to an HMAC secret means a forged cookie
// won't carry a signature the server will accept. The same-origin policy still
// does the heavy lifting (a cross-site page can't read the cookie to mirror it
// into the header); the signature is defense in depth.
//
// Built on Web Crypto (`crypto.subtle`), present in Workers, Bun, and Node ≥ 20 —
// no Node-only `crypto` import, so it runs unchanged on the edge.

import { readCookie } from "./cookies";

/** How the double-submit token is carried. Defaults match what a host would set. */
export interface CsrfOptions {
  /** Secret the token is HMAC-signed with. Must match across issue + verify. */
  readonly secret: string;
  /** Cookie the token is stored in. Default `voila_csrf`. */
  readonly cookieName?: string;
  /** Request header the token is echoed in. Default `x-csrf-token`. */
  readonly headerName?: string;
}

export const DEFAULT_COOKIE_NAME = "voila_csrf";
export const DEFAULT_HEADER_NAME = "x-csrf-token";

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(signature));
}

// Length-stable comparison: never short-circuits on the first differing byte, so
// a timing side-channel can't probe the signature one character at a time.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Mint a fresh signed double-submit token. The host sets it as the CSRF cookie
 * (at login, say) and hands the same value to the client to echo in the header.
 */
export async function issueCsrfToken(secret: string): Promise<string> {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const payload = toHex(random);
  const signature = await sign(secret, payload);
  return `${payload}.${signature}`;
}

/** Whether a token's signature verifies against the secret (shape + HMAC). */
export async function verifyCsrfToken(secret: string, token: string): Promise<boolean> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await sign(secret, payload);
  return timingSafeEqual(signature, expected);
}

/**
 * The full request-level double-submit check: the cookie and header tokens must
 * both be present, equal, and carry a valid signature. Any miss is a CSRF
 * failure (the dispatcher maps it to 403).
 */
export async function verifyCsrf(request: Request, options: CsrfOptions): Promise<boolean> {
  const headerName = options.headerName ?? DEFAULT_HEADER_NAME;
  const headerToken = request.headers.get(headerName);
  if (!headerToken) return false;

  const cookieToken = readCookie(request, options.cookieName ?? DEFAULT_COOKIE_NAME);
  if (!cookieToken) return false;

  if (!timingSafeEqual(headerToken, cookieToken)) return false;
  return verifyCsrfToken(options.secret, headerToken);
}
