// The CSRF-aware `fetch` the typed client wraps in the admin. Two jobs the secure
// admin needs (lifted from the demo's `app/lib/content-client.ts`, now framework-
// owned and configurable): mirror the `voila_csrf` cookie into the
// `x-csrf-token` header on writes (the engine's double-submit check), and bounce
// an expired/absent session (401) to the login page.

import type { Fetch } from "@voila/content/client";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface AuthedFetchOptions {
  /** Where a 401 redirects. Default `/admin/login`. */
  readonly loginPath?: string;
  /** CSRF cookie name. Default `voila_csrf` (matches the engine default). */
  readonly cookieName?: string;
  /** Header the token is mirrored into. Default `x-csrf-token`. */
  readonly csrfHeader?: string;
  /** Underlying fetch. Default the global `fetch` (injectable for tests). */
  readonly fetch?: Fetch;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
}

/** Build a `fetch` that adds the CSRF header on writes and redirects on 401. */
export function makeAuthedFetch(options: AuthedFetchOptions = {}): Fetch {
  const loginPath = options.loginPath ?? "/admin/login";
  const cookieName = options.cookieName ?? "voila_csrf";
  const csrfHeader = options.csrfHeader ?? "x-csrf-token";
  const baseFetch = options.fetch ?? ((input, init) => fetch(input, init));

  return async (input, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    let nextInit = init;
    if (MUTATING.has(method)) {
      const token = readCookie(cookieName);
      if (token) {
        const headers = new Headers(init?.headers);
        headers.set(csrfHeader, token);
        nextInit = { ...init, headers };
      }
    }
    const response = await baseFetch(input, nextInit);
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith(loginPath)
    ) {
      window.location.assign(loginPath);
    }
    return response;
  };
}
