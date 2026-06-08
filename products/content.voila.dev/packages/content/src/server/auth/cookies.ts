// A tiny `Cookie:` header reader — enough for the CSRF double-submit check to
// pull one named value off a request. Not a full RFC 6265 parser: it splits on
// `;`, trims, and decodes each value, which is all the engine needs to compare a
// cookie token against a header token. Writing cookies is the host's job.

/** Read a single cookie value by name, or `null` when it isn't present. */
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      // A malformed `%`-escape means the cookie can't be the token we minted.
      return null;
    }
  }
  return null;
}
