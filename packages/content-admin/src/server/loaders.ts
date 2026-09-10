// Plain server-side helpers the host's route shims wrap in `createServerFn`
// (keeping the server-only `@voila/content/server` import out of the client
// bundle). `countDocuments` powers the dashboard's SSR counts; `resolveSession`
// powers the `/admin` guard + login redirect. Logic lives here so a version bump
// updates every site; the tiny `createServerFn` wrapper stays in the app.

import type { NormalizedConfig } from "@voila/content";
import type { Authenticator, Database } from "@voila/content/server";
import { brandSingletons, readBrandSource } from "../lib/brand-source";
import type { AdminBrandSource, ResolvedAdminTheme } from "../types";

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

/**
 * Read the brand the editors own — the accent colour and the logo named by
 * `defineAdmin`'s `theme.accentFrom` / `theme.logoFrom` — straight out of the
 * singletons that hold them.
 *
 * Call it from the root route's loader and pass the result to `brandingHead`
 * and `AdminProvider`: it has to be resolved server-side, before the document is
 * streamed, or the admin paints unbranded and then repaints. A theme that reads
 * no content does no queries; a failed read yields no brand rather than a 500 —
 * a missing settings row must not take the admin down.
 */
export async function resolveBrandSource(
  theme: ResolvedAdminTheme,
  database: Database,
): Promise<AdminBrandSource> {
  const slugs = brandSingletons(theme);
  if (slugs.length === 0) return readBrandSource(theme, {});
  const entries = await Promise.all(
    slugs.map(async (slug): Promise<[string, unknown]> => {
      try {
        // A singleton's one row is pinned to `id = slug` by its table CHECK.
        return [slug, await database.get(slug, slug)];
      } catch {
        return [slug, null];
      }
    }),
  );
  return readBrandSource(theme, Object.fromEntries(entries));
}
