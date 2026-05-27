export interface SlugifyOptions {
  /** Trim a leading/trailing separator from the result. Default `true`. */
  trim?: boolean;
}

/** Escape a separator string for safe use inside a `RegExp`. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Combining diacritical marks (U+0300–U+036F), stripped after NFKD normalize. */
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Turn arbitrary text into a URL-safe slug: strip diacritics, lowercase, and
 * collapse runs of non-alphanumerics into a single `separator`.
 *
 * `trim` is left on by default (the stored value must satisfy the slug
 * validator, which forbids a leading/trailing separator) but can be switched
 * off so the slug widget tolerates a trailing separator *while* the user is
 * typing the next word — it gets trimmed again on blur.
 */
export function slugify(input: string, separator = "-", options: SlugifyOptions = {}): string {
  const { trim = true } = options;
  const sep = escapeRe(separator);
  let s = input
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`${sep}{2,}`, "g"), separator);
  if (trim) s = s.replace(new RegExp(`^${sep}|${sep}$`, "g"), "");
  return s;
}
