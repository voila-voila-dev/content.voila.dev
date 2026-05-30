// VENDED by @voila/content-registry — you own this file.
// Thin browser helpers over the Better Auth endpoints the worker serves at
// `/admin/api/auth/*`. No Better Auth client SDK needed — these are plain fetches
// (same-origin, so the session cookie rides along automatically).

export interface SessionUser {
  readonly id: string;
  readonly email: string;
}

/** Request a magic-link email for `email`; the link returns to `callbackURL`. */
export const signInMagicLink = async (email: string, callbackURL = "/admin"): Promise<void> => {
  const res = await fetch("/admin/api/auth/sign-in/magic-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, callbackURL }),
  });
  if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
};

/** Resolve the current session's user, or `null` when unauthenticated. */
export const getSessionUser = async (): Promise<SessionUser | null> => {
  const res = await fetch("/admin/api/auth/get-session", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { user?: SessionUser } | null;
  return body?.user ?? null;
};

/** End the current session. */
export const signOut = async (): Promise<void> => {
  await fetch("/admin/api/auth/sign-out", { method: "POST" });
};
