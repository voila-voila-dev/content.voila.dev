// Plain server-side helpers the host's route shims wrap in `createServerFn`
// (keeping the server-only `@voila/content/server` import out of the client
// bundle). `countDocuments` powers the dashboard's SSR counts; `resolveSession`
// powers the `/admin` guard + login redirect. Logic lives here so a version bump
// updates every site; the tiny `createServerFn` wrapper stays in the app.

import type { NormalizedConfig } from "@voila/content";
import type { Authenticator, Database } from "@voila/content/server";

/** The signed-in user the admin chrome needs. */
export interface SessionUser {
  readonly id: string;
  readonly email: string | null;
}

/**
 * Document count per collection slug, counting every document including drafts.
 * A failed count omits its slug (the dashboard card falls back to a placeholder
 * rather than a wrong 0).
 */
export async function countDocuments(
  config: NormalizedConfig,
  database: Database,
): Promise<Record<string, number>> {
  const slugs = Object.keys(config.collections);
  const entries = await Promise.all(
    slugs.map(async (slug): Promise<[string, number] | null> => {
      try {
        const { total } = await database.list(slug, { limit: 1, count: true, status: "any" });
        return total === undefined ? null : [slug, total];
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/** Resolve the session for a request, or `null` when signed out. */
export async function resolveSession(
  authenticator: Authenticator,
  request: Request,
): Promise<{ user: SessionUser } | null> {
  const principal = await authenticator.authenticate(request);
  if (!principal) return null;
  return { user: { id: principal.id, email: principal.email ?? null } };
}
