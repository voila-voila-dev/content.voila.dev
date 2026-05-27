import { beforeAll, describe, expect, test } from "bun:test";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfSetCookie,
  generateCsrfToken,
  isSecureRequest,
  issueCsrf,
  readCookie,
  timingSafeEqual,
  verifyCsrf,
} from "./csrf.ts";

const SECRET = "test-secret-for-csrf-hmac";
const OTHER_SECRET = "a-different-server-secret";

// happy-dom's DOM `Request` drops the `Cookie` header (browser forbidden-header
// rule); use the runtime's native `Request`, preserved by `test/setup.ts`.
const RealRequest = (globalThis as { NativeRequest?: typeof Request }).NativeRequest ?? Request;

function withCookie(cookie?: string, header?: string): Request {
  const headers = new Headers();
  if (cookie !== undefined) headers.set("cookie", cookie);
  if (header !== undefined) headers.set(CSRF_HEADER, header);
  return new RealRequest("https://example.com/admin/api/posts", { method: "POST", headers });
}

let TOKEN: string;
beforeAll(async () => {
  TOKEN = await generateCsrfToken(SECRET);
});

describe("generateCsrfToken", () => {
  test("produces a signed `<payload>.<sig>` token, unique per call", async () => {
    const a = await generateCsrfToken(SECRET);
    const b = await generateCsrfToken(SECRET);
    expect(a).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b); // random payload
  });
});

describe("readCookie", () => {
  test("extracts a named cookie from the header", () => {
    const req = withCookie(`other=1; ${CSRF_COOKIE}=${TOKEN}; another=2`);
    expect(readCookie(req, CSRF_COOKIE)).toBe(TOKEN);
  });

  test("returns undefined when absent or no cookie header", () => {
    expect(readCookie(withCookie("other=1"), CSRF_COOKIE)).toBeUndefined();
    expect(readCookie(withCookie(), CSRF_COOKIE)).toBeUndefined();
  });
});

describe("verifyCsrf", () => {
  test("passes when cookie and header carry the same validly-signed token", async () => {
    const result = await verifyCsrf(withCookie(`${CSRF_COOKIE}=${TOKEN}`, TOKEN), SECRET);
    expect(result.ok).toBe(true);
  });

  test("fails (CSRF) when the header is missing", async () => {
    const result = await verifyCsrf(withCookie(`${CSRF_COOKIE}=${TOKEN}`), SECRET);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("CSRF");
  });

  test("fails when the cookie is missing", async () => {
    expect((await verifyCsrf(withCookie(undefined, TOKEN), SECRET)).ok).toBe(false);
  });

  test("fails when cookie and header disagree (two distinct valid tokens)", async () => {
    const other = await generateCsrfToken(SECRET);
    const result = await verifyCsrf(withCookie(`${CSRF_COOKIE}=${TOKEN}`, other), SECRET);
    expect(result.ok).toBe(false);
  });

  test("fails a forged token whose signature doesn't match the secret", async () => {
    const forged = "AAAAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBB";
    const result = await verifyCsrf(withCookie(`${CSRF_COOKIE}=${forged}`, forged), SECRET);
    expect(result.ok).toBe(false);
  });

  test("fails a token signed with a different secret (defeats cookie injection)", async () => {
    const injected = await generateCsrfToken(OTHER_SECRET);
    const result = await verifyCsrf(withCookie(`${CSRF_COOKIE}=${injected}`, injected), SECRET);
    expect(result.ok).toBe(false);
  });
});

describe("issueCsrf", () => {
  test("reuses an existing validly-signed cookie", async () => {
    const { token, isNew } = await issueCsrf(withCookie(`${CSRF_COOKIE}=${TOKEN}`), SECRET);
    expect(token).toBe(TOKEN);
    expect(isNew).toBe(false);
  });

  test("mints a new token when none / a forged one is present", async () => {
    const fresh = await issueCsrf(withCookie(), SECRET);
    expect(fresh.isNew).toBe(true);
    expect(fresh.token).toContain(".");
    const forged = await issueCsrf(withCookie(`${CSRF_COOKIE}=not-a-signed-token`), SECRET);
    expect(forged.isNew).toBe(true);
  });
});

describe("csrfSetCookie", () => {
  test("is readable by JS (no HttpOnly) and scoped/laxed", () => {
    const cookie = csrfSetCookie(TOKEN, { secure: true });
    expect(cookie).toContain(`${CSRF_COOKIE}=${TOKEN}`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("HttpOnly");
  });

  test("omits Secure for insecure (local http) origins", () => {
    expect(csrfSetCookie(TOKEN, { secure: false })).not.toContain("Secure");
  });
});

describe("isSecureRequest", () => {
  test("true for https, false for http", () => {
    expect(isSecureRequest(new RealRequest("https://x.dev/"))).toBe(true);
    expect(isSecureRequest(new RealRequest("http://localhost:8787/"))).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  test("true only for identical strings; length mismatch is false", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
