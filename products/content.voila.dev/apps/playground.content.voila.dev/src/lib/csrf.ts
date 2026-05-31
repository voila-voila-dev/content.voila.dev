// VENDED by @voila/content-registry — you own this file.
// Browser CSRF helper for the double-submit scheme. The server's `/admin/api/csrf`
// mint sets a JS-readable `voila_csrf` cookie (and returns the token); the write
// client echoes that token in the `x-voila-csrf` header while the browser sends the
// cookie automatically (same-origin). The cookie name + header are the contract with
// the engine's `CsrfMiddleware`.
export const CSRF_COOKIE = "voila_csrf";
export const CSRF_HEADER = "x-voila-csrf";

const readCookie = (name: string): string | undefined => {
  for (const part of document.cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
};

/** The current CSRF token, minting a fresh one (and setting the cookie) if absent. */
export const getCsrfToken = async (): Promise<string> => {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  const res = await fetch("/admin/api/csrf", { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`csrf mint failed (${res.status})`);
  const body = (await res.json()) as { token: string };
  return body.token;
};
