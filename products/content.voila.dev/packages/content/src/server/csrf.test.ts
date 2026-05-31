// CSRF middleware unit tests: a freshly minted token (matching cookie + header)
// passes; a missing, mismatched, or tampered token is rejected with `Forbidden`.

import { describe, expect, it } from "bun:test";
import { Effect, Exit } from "effect";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  CsrfMiddleware,
  CsrfMiddlewareLive,
  mintCsrfToken,
} from "./csrf";

const SECRET = "test-secret-at-least-32-chars-long-xx";

// Invoke the middleware with the given wire headers, returning the Exit.
const check = (secret: string, headers: Record<string, string>) =>
  Effect.runPromise(
    Effect.exit(
      Effect.flatMap(CsrfMiddleware, (middleware) =>
        // The middleware only reads `headers`; the other RPC options are unused.
        (middleware as (o: { headers: Record<string, string> }) => Effect.Effect<void, unknown>)({
          headers,
        }),
      ).pipe(Effect.provide(CsrfMiddlewareLive(secret))),
    ),
  );

const headersFor = (
  cookieToken: string | null,
  headerToken: string | null,
): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (cookieToken !== null) headers.cookie = `${CSRF_COOKIE}=${cookieToken}`;
  if (headerToken !== null) headers[CSRF_HEADER] = headerToken;
  return headers;
};

describe("CsrfMiddleware", () => {
  it("accepts a matching, validly-signed token", async () => {
    const token = await mintCsrfToken(SECRET);
    const exit = await check(SECRET, headersFor(token, token));
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("rejects a missing token", async () => {
    const exit = await check(SECRET, headersFor(null, null));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects when the header does not match the cookie", async () => {
    const a = await mintCsrfToken(SECRET);
    const b = await mintCsrfToken(SECRET);
    const exit = await check(SECRET, headersFor(a, b));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects a token whose signature was tampered with", async () => {
    const token = await mintCsrfToken(SECRET);
    const tampered = `${token.slice(0, token.lastIndexOf(".") + 1)}AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const exit = await check(SECRET, headersFor(tampered, tampered));
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("rejects a token minted under a different secret", async () => {
    const token = await mintCsrfToken("a-totally-different-secret-value-32xx");
    const exit = await check(SECRET, headersFor(token, token));
    expect(Exit.isFailure(exit)).toBe(true);
  });
});
