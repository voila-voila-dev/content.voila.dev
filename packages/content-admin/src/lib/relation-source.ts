// Turns a relation field's target slug into pickable options, using the admin's
// own typed client. `@voila/content-ui` deliberately never fetches, so this is
// the admin half of the relation widget: `defineAdmin` builds one loader and
// injects it into both registries.
//
// Options are fetched once per target collection and memoised for the life of
// the admin instance — a picker opened on ten rows of a table should hit the
// API once, not ten times. The cache is per-`defineAdmin` (not module-global),
// so two admins on one page can't read each other's rows.

import type { NormalizedConfig } from "@voila/content";
import type { RelationLoader, RelationOption } from "@voila/content-ui";

/** How many rows a picker holds in total. Beyond this the editor types to filter. */
const OPTION_CAP = 500;
/** The REST list endpoint rejects anything above 100, so page up to the cap. */
const PAGE_SIZE = 100;

interface ListLike {
  list(params?: {
    limit?: number;
    cursor?: string;
    orderBy?: string;
    order?: "asc" | "desc";
  }): Promise<{
    readonly data: ReadonlyArray<Record<string, unknown>>;
    readonly nextCursor?: string | null;
  }>;
}

/**
 * The human label for a related row: its collection's `titleField`, falling back
 * to a `title`/`name`/`label` field, then the id. A localized title arrives as a
 * per-locale record, so it resolves through the project's default locale and
 * then any locale that carries text — the same fallback the read path uses.
 */
export function relationLabel(
  row: Record<string, unknown>,
  titleField: string | undefined,
  defaultLocale: string | undefined,
): string {
  const candidates = [titleField, "title", "name", "label"].filter(
    (k): k is string => typeof k === "string",
  );
  for (const key of candidates) {
    const resolved = resolveText(row[key], defaultLocale);
    if (resolved !== undefined) return resolved;
  }
  return String(row.id ?? "");
}

function resolveText(value: unknown, defaultLocale: string | undefined): string | undefined {
  if (typeof value === "string") return value === "" ? undefined : value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const preferred = defaultLocale === undefined ? undefined : record[defaultLocale];
  if (typeof preferred === "string" && preferred !== "") return preferred;
  for (const v of Object.values(record)) {
    if (typeof v === "string" && v !== "") return v;
  }
  return undefined;
}

/**
 * Build the loader `createRelationInput` / `createRelationDisplay` call. Unknown
 * target slugs and failed requests reject, which is what makes the widget fall
 * back to its honest id input rather than showing an empty picker.
 */
export function makeRelationLoader(config: NormalizedConfig, client: unknown): RelationLoader {
  const cache = new Map<string, Promise<ReadonlyArray<RelationOption>>>();
  const defaultLocale = config.i18n?.defaultLocale;
  return (slug) => {
    const cached = cache.get(slug);
    if (cached !== undefined) return cached;
    const pending = load(slug);
    cache.set(slug, pending);
    // A failed load must not poison the cache — the next picker should retry.
    pending.catch(() => cache.delete(slug));
    return pending;
  };

  async function load(slug: string): Promise<ReadonlyArray<RelationOption>> {
    const collection = config.collections[slug];
    if (collection === undefined) throw new Error(`Unknown relation target "${slug}".`);
    const accessor = (client as Record<string, ListLike | undefined>)[slug];
    if (accessor === undefined) throw new Error(`No client accessor for "${slug}".`);
    // Keyset-page to the cap rather than asking for everything at once: the
    // list endpoint refuses a limit above 100, and one oversized request used
    // to 400, silently dropping every picker back to raw ids.
    const rows: Array<Record<string, unknown>> = [];
    let cursor: string | undefined;
    while (rows.length < OPTION_CAP) {
      const page = await accessor.list({ limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) });
      rows.push(...page.data);
      const next = page.nextCursor;
      if (typeof next !== "string" || next === "" || page.data.length === 0) break;
      cursor = next;
    }
    return rows.slice(0, OPTION_CAP).map((row) => {
      const id = String(row.id ?? "");
      const option: RelationOption = {
        value: id,
        label: relationLabel(row, collection.titleField, defaultLocale),
      };
      // A secondary line only helps when it isn't the label again.
      const hint = resolveText(row.slug, defaultLocale);
      return hint !== undefined && hint !== option.label ? { ...option, hint } : option;
    });
  }
}
