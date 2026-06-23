// CSRF signed-double-submit unit tests: a minted token verifies, tampering or a
// wrong secret fails, and the request-level check enforces the cookie/header
// pair. The cookie reader is exercised here too since it's the other half of the
// double-submit contract.

import { describe, expect, it } from "bun:test";
import { readCookie } from "./cookies";
import {
  DEFAULT_COOKIE_NAME,
  DEFAULT_HEADER_NAME,
  issueCsrfToken,
  verifyCsrf,
  verifyCsrfToken,
} from "./csrf";

const SECRET = "test-secret";

// Build a request carrying a CSRF cookie + header, with optional overrides so a
// test can break exactly one half of the double-submit.
function csrfRequest(opts: { cookie?: string; header?: string; method?: string }): Request {
  const headers = new Headers();
  if (opts.cookie !== undefined) headers.set("cookie", `${DEFAULT_COOKIE_NAME}=${opts.cookie}`);
  if (opts.header !== undefined) headers.set(DEFAULT_HEADER_NAME, opts.header);
  return new Request("https://x/admin/api/posts", { method: opts.method ?? "POST", headers });
}

describe("verifyCsrfToken", () => {
  it("accepts a freshly minted token", async () => {
    const token = await issueCsrfToken(SECRET);
    expect(await verifyCsrfToken(SECRET, token)).toBe(true);
  });

  it("mints a distinct token each call", async () => {
    const a = await issueCsrfToken(SECRET);
    const b = await issueCsrfToken(SECRET);
    expect(a).not.toBe(b);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await issueCsrfToken(SECRET);
    expect(await verifyCsrfToken("other-secret", token)).toBe(false);
  });

  it("rejects a tampered payload", async () => {
    const token = await issueCsrfToken(SECRET);
    const [payload, signature] = token.split(".");
    const forged = `${payload}deadbeef.${signature}`;
    expect(await verifyCsrfToken(SECRET, forged)).toBe(false);
  });

  it.each(["", "no-dot", "payload.", ".signature"])("rejects malformed token %p", async (token) => {
    expect(await verifyCsrfToken(SECRET, token)).toBe(false);
  });
});

describe("verifyCsrf (request-level double-submit)", () => {
  it("passes when cookie and header carry the same valid token", async () => {
    const token = await issueCsrfToken(SECRET);
    expect(
      await verifyCsrf(csrfRequest({ cookie: token, header: token }), { secret: SECRET }),
    ).toBe(true);
  });

  it("fails when the header is missing", async () => {
    const token = await issueCsrfToken(SECRET);
    expect(await verifyCsrf(csrfRequest({ cookie: token }), { secret: SECRET })).toBe(false);
  });

  it("fails when the cookie is missing", async () => {
    const token = await issueCsrfToken(SECRET);
    expect(await verifyCsrf(csrfRequest({ header: token }), { secret: SECRET })).toBe(false);
  });

  it("fails when cookie and header disagree", async () => {
    const a = await issueCsrfToken(SECRET);
    const b = await issueCsrfToken(SECRET);
    expect(await verifyCsrf(csrfRequest({ cookie: a, header: b }), { secret: SECRET })).toBe(false);
  });

  it("fails when both copies match but the signature is invalid", async () => {
    // An attacker who controls the cookie *and* mirrors it into the header still
    // can't forge a signature the secret accepts.
    const forged = "deadbeef.deadbeef";
    expect(
      await verifyCsrf(csrfRequest({ cookie: forged, header: forged }), { secret: SECRET }),
    ).toBe(false);
  });

  it("honours custom cookie/header names", async () => {
    const token = await issueCsrfToken(SECRET);
    const request = new Request("https://x/admin/api/posts", {
      method: "POST",
      headers: { cookie: `csrf=${token}`, "x-xsrf": token },
    });
    expect(
      await verifyCsrf(request, { secret: SECRET, cookieName: "csrf", headerName: "x-xsrf" }),
    ).toBe(true);
  });
});

describe("readCookie", () => {
  it("reads a named value among several cookies", () => {
    const request = new Request("https://x", { headers: { cookie: "a=1; voila_csrf=tok; b=2" } });
    expect(readCookie(request, "voila_csrf")).toBe("tok");
  });

  it("decodes percent-escapes", () => {
    const request = new Request("https://x", { headers: { cookie: "v=a%20b" } });
    expect(readCookie(request, "v")).toBe("a b");
  });

  it("returns null when absent or no cookie header", () => {
    expect(readCookie(new Request("https://x", { headers: { cookie: "a=1" } }), "v")).toBeNull();
    expect(readCookie(new Request("https://x"), "v")).toBeNull();
  });
});
