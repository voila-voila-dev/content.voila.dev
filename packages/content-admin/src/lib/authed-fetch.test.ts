// Runs under the shared happy-dom setup (document.cookie + window.location).
import { afterEach, describe, expect, it } from "bun:test";
import { makeAuthedFetch } from "./authed-fetch";

function stubResponse(status: number): Response {
  return new Response(null, { status });
}

// The function under test reads `document.cookie`, so the fixture writes it.
function setCookie(value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: seeding the CSRF cookie is the point of the test
  document.cookie = value;
}

afterEach(() => {
  for (const c of document.cookie.split(";")) {
    const name = c.split("=")[0]?.trim();
    if (name) setCookie(`${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`);
  }
});

describe("makeAuthedFetch", () => {
  it("mirrors the CSRF cookie into the header on writes", async () => {
    setCookie("voila_csrf=tok123");
    let seen: Headers | undefined;
    const authed = makeAuthedFetch({
      fetch: async (_input, init) => {
        seen = new Headers(init?.headers);
        return stubResponse(200);
      },
    });
    await authed("https://x/admin/api/posts", { method: "POST" });
    expect(seen?.get("x-csrf-token")).toBe("tok123");
  });

  it("does not add the CSRF header on reads", async () => {
    setCookie("voila_csrf=tok123");
    let seen: Headers | undefined;
    const authed = makeAuthedFetch({
      fetch: async (_input, init) => {
        seen = new Headers(init?.headers);
        return stubResponse(200);
      },
    });
    await authed("https://x/admin/api/posts", { method: "GET" });
    expect(seen?.get("x-csrf-token")).toBeNull();
  });

  it("honours custom cookie + header names", async () => {
    setCookie("csrf2=abc");
    let seen: Headers | undefined;
    const authed = makeAuthedFetch({
      cookieName: "csrf2",
      csrfHeader: "x-xsrf",
      fetch: async (_input, init) => {
        seen = new Headers(init?.headers);
        return stubResponse(200);
      },
    });
    await authed("https://x/admin/api/posts", { method: "DELETE" });
    expect(seen?.get("x-xsrf")).toBe("abc");
  });

  it("passes the response through unchanged on success", async () => {
    const authed = makeAuthedFetch({ fetch: async () => stubResponse(201) });
    const res = await authed("https://x/admin/api/posts", { method: "POST" });
    expect(res.status).toBe(201);
  });
});
